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
    const { attendanceId, data, staff_session_token } = body;

    // Auth: staff session token OR base44.auth.me()
    let user = null;

    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (payload) {
        user = { email: payload.email, role: payload.role };
      }
    }

    if (!user) {
      const baseUser = await base44.auth.me().catch(() => null);
      if (baseUser) {
        user = baseUser;
      }
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!attendanceId || !data) {
      return Response.json(
        { error: 'attendanceId and data are required' },
        { status: 400 }
      );
    }

    // Fetch existing record using service role (read-only)
    const existingRecords = await base44.asServiceRole.entities.Attendance.filter({
      id: attendanceId
    });

    if (existingRecords.length === 0) {
      return Response.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    const existingRecord = existingRecords[0];

    // ── TODAY-ONLY ATTENDANCE (CHECK FIRST - BEFORE LOCK CHECK) ──
    // Non-admin/principal users can ONLY mark attendance for TODAY
    const userRole = (user.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';
    const attendanceDate = data.date || existingRecord.date;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const attDate = new Date(attendanceDate);
    attDate.setUTCHours(0, 0, 0, 0);

    if (!isAdmin && attDate.getTime() !== today.getTime()) {
      return Response.json(
        { error: `Teachers can only mark attendance for today. Attempted date: ${attendanceDate}` },
        { status: 400 }
      );
    }

    // ── LOCK ENFORCEMENT (CHECK AFTER TODAY-ONLY) ──
    // Non-admin/principal users cannot edit locked records
    if (existingRecord.is_locked) {
      if (!isAdmin) {
        return Response.json(
          { error: 'Attendance is locked. Only admin can unlock and edit.' },
          { status: 403 }
        );
      }

      // Admin audit log for unlock/edit action
      const auditData = {
        action: 'unlock_and_edit',
        module: 'Attendance',
        date: existingRecord.date,
        performed_by: user.email,
        details: `Unlocked and edited attendance for student ${existingRecord.student_id} on ${existingRecord.date}. Changes: ${JSON.stringify(data)}`,
        academic_year: existingRecord.academic_year
      };

      try {
        await base44.asServiceRole.entities.AuditLog.create(auditData);
      } catch (auditError) {
        console.warn('Audit log failed but proceeding with unlock:', auditError);
      }
    }

    // ── STUDENT EXISTENCE & SOFT-DELETE GUARD ──
    const studentId = data.student_id || existingRecord.student_id;
    const ayForCheck = data.academic_year || existingRecord.academic_year;
    if (studentId && ayForCheck) {
      const studentsForId = await base44.asServiceRole.entities.Student.filter({ student_id: studentId, academic_year: ayForCheck });
      const studentForCheck = studentsForId[0];

      // Check if student exists
      if (!studentForCheck) {
        return Response.json({
          error: `Student '${studentId}' does not exist in database`,
          status: 404
        });
      }

      // Check if student is deleted
      if (studentForCheck.is_deleted === true) {
        return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });
      }
    }

    // ── ACADEMIC YEAR BOUNDARY CHECK ──
    const attendanceAcademicYear = data.academic_year || existingRecord.academic_year;
    if (attendanceDate && attendanceAcademicYear) {
      const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: attendanceAcademicYear });
      if (yearConfigs.length > 0) {
        const yearConfig = yearConfigs[0];
        if (!validateAcademicYearBoundary(attendanceDate, yearConfig.start_date, yearConfig.end_date)) {
          return Response.json({
            error: `Action not allowed outside selected Academic Year. Date "${attendanceDate}" is outside the ${attendanceAcademicYear} range (${yearConfig.start_date} to ${yearConfig.end_date}).`
          }, { status: 400 });
        }
      }
    }

    // ── STUDENT ACADEMIC YEAR MISMATCH GUARD ──
    const attStudentId = data.student_id || existingRecord.student_id;
    const attAcademicYear = data.academic_year || existingRecord.academic_year;
    if (attStudentId && attAcademicYear) {
      const matchingStudents = await base44.asServiceRole.entities.Student.filter({ student_id: attStudentId });
      if (matchingStudents.length > 0) {
        const student = matchingStudents[0];
        if (student.academic_year && student.academic_year !== attAcademicYear) {
          return Response.json({
            error: `Academic year mismatch: student "${attStudentId}" belongs to year "${student.academic_year}" but attendance is for "${attAcademicYear}".`
          }, { status: 400 });
        }
      }
    }

    // Deduplication check
    if (data.student_id && data.student_id !== existingRecord.student_id) {
      const duplicates = await base44.asServiceRole.entities.Attendance.filter({
        student_id: data.student_id,
        date: data.date || existingRecord.date,
        class_name: data.class_name || existingRecord.class_name,
        section: data.section || existingRecord.section,
        academic_year: data.academic_year || existingRecord.academic_year
      });

      if (duplicates.length > 0) {
        return Response.json(
          { error: 'Duplicate attendance record would be created. One record per student per date allowed.' },
          { status: 409 }
        );
      }
    }

    await base44.asServiceRole.entities.Attendance.update(attendanceId, data);

    // ── AUTO-LOCK AFTER SAVE (ADMIN UNLOCK & EDIT) ──
    // If admin is editing an unlocked record, lock it again after save
    if (isAdmin) {
      try {
        await base44.asServiceRole.entities.Attendance.update(attendanceId, {
          is_locked: true,
          locked_at: new Date().toISOString()
        });
      } catch (lockError) {
        console.warn('Auto-lock after save failed but proceeding:', lockError);
        // Don't fail the entire operation if lock fails
      }
    }

    return Response.json({
      message: 'Attendance updated successfully',
      success: true,
      locked: isAdmin // Indicate to frontend that record was locked
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    return Response.json(
      { error: error.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
});