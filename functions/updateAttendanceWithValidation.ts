import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function validateAcademicYearBoundary(date, academicYearStart, academicYearEnd) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const start = new Date(academicYearStart);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(academicYearEnd);
  end.setUTCHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

async function verifyStaffToken(token) {
  try {
    const secret = Deno.env.get('STAFF_SESSION_SECRET');
    if (!secret || !token) return null;
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 0) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    let exp = payload.exp;
    if (exp > 1e12) exp = Math.floor(exp / 1000);
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { data, staff_session_token } = body;

    // Auth: ONLY via staff session token
    let user = null;
    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (payload) {
        user = { email: payload.email, role: payload.role };
      }
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized — valid staff_session_token required' }, { status: 401 });
    }

    const staff_email = user.email;
    if (!staff_email) {
      return Response.json({ error: 'Invalid staff session — email missing from token' }, { status: 401 });
    }

    if (!data || !data.date || !data.class_name || !data.section || !data.student_id || !data.academic_year) {
      return Response.json(
        { error: 'data with date, class_name, section, student_id, and academic_year are required' },
        { status: 400 }
      );
    }

    const userRole = (user.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';
    const { date, class_name, section, student_id, academic_year } = data;

    // ── TODAY-ONLY ATTENDANCE ──
    // Non-admin/principal users can ONLY mark attendance for TODAY
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const attDate = new Date(date);
    attDate.setUTCHours(0, 0, 0, 0);

    if (!isAdmin && attDate.getTime() !== today.getTime()) {
      return Response.json(
        { error: `Teachers can only mark attendance for today. Attempted date: ${date}` },
        { status: 400 }
      );
    }

    // ── ACADEMIC YEAR BOUNDARY CHECK ──
    const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year });
    if (yearConfigs.length > 0) {
      const yearConfig = yearConfigs[0];
      if (!validateAcademicYearBoundary(date, yearConfig.start_date, yearConfig.end_date)) {
        return Response.json({
          error: `Action not allowed outside selected Academic Year. Date "${date}" is outside the ${academic_year} range (${yearConfig.start_date} to ${yearConfig.end_date}).`
        }, { status: 400 });
      }
    }

    // ── STUDENT EXISTENCE & SOFT-DELETE GUARD ──
    const studentsForId = await base44.asServiceRole.entities.Student.filter({ student_id, academic_year });
    const studentForCheck = studentsForId[0];
    if (!studentForCheck) {
      return Response.json({ error: `Student '${student_id}' does not exist in database` }, { status: 404 });
    }
    if (studentForCheck.is_deleted === true) {
      return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });
    }

    // ── STUDENT ACADEMIC YEAR MISMATCH GUARD ──
    if (studentForCheck.academic_year && studentForCheck.academic_year !== academic_year) {
      return Response.json({
        error: `Academic year mismatch: student "${student_id}" belongs to year "${studentForCheck.academic_year}" but attendance is for "${academic_year}".`
      }, { status: 400 });
    }

    // ── UPSERT: Find existing record by composite key ──
    const existingRecords = await base44.asServiceRole.entities.Attendance.filter({
      date,
      class_name,
      section,
      student_id,
      academic_year
    });

    const existingRecord = existingRecords[0] || null;

    // ── LOCK ENFORCEMENT ──
    if (existingRecord && existingRecord.is_locked) {
      if (!isAdmin) {
        return Response.json(
          { error: 'Attendance locked after 15:30 IST. Only admin can unlock and edit.' },
          { status: 403 }
        );
      }
      // Admin audit log for unlock/edit
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'unlock_and_edit',
          module: 'Attendance',
          date: existingRecord.date,
          performed_by: user.email,
          details: `Unlocked and edited attendance for student ${student_id} on ${date}. Changes: ${JSON.stringify(data)}`,
          academic_year
        });
      } catch (auditError) {
        console.warn('Audit log failed but proceeding with unlock:', auditError);
      }
    }

    // ── FORCE SUBMISSION FIELDS ──
    const now = new Date().toISOString();
    const savePayload = {
      ...data,
      status: 'Submitted',
      marked_by: user.email,
      submitted_at: now
    };

    if (existingRecord) {
      // UPDATE
      await base44.asServiceRole.entities.Attendance.update(existingRecord.id, savePayload);
      return Response.json({ message: 'Attendance updated successfully', success: true, action: 'updated' });
    } else {
      // CREATE
      await base44.asServiceRole.entities.Attendance.create(savePayload);
      return Response.json({ message: 'Attendance created successfully', success: true, action: 'created' });
    }

  } catch (error) {
    console.error('Update attendance error:', error);
    return Response.json(
      { error: error.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
});