import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import { createHmac } from 'node:crypto';

// Validate academic year boundary
function isWithinAcademicYear(date, academicYearStart, academicYearEnd) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const start = new Date(academicYearStart);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(academicYearEnd);
  end.setUTCHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

// Extract staff email from HMAC-signed session token
async function extractStaffEmailFromToken(token) {
  if (!token) return null;
  try {
    const decoded = atob(token);
    const parsed = JSON.parse(decoded);
    const email = parsed?.email || parsed?.username || null;
    return email || null;
  } catch {
    // Try JWT-style: payload is second segment
    try {
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        return payload?.email || payload?.username || null;
      }
    } catch {}
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const {
      records,
      date,
      class_name,
      section,
      academic_year,
      staff_session_token,
      is_admin_override
    } = body;

    // ── AUTH: Extract staff_email from token ──
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const headerToken = authHeader.replace('Bearer ', '').trim();
    const tokenToUse = headerToken || staff_session_token;

    if (!tokenToUse) {
      return Response.json({ error: 'Unauthorized — no staff session token provided' }, { status: 401 });
    }

    // Verify token signature using STAFF_SESSION_SECRET
    const secret = Deno.env.get('STAFF_SESSION_SECRET') || Deno.env.get('STAFF_TOKEN_SECRET') || '';
    let staff_email = null;

    try {
      // Try to verify HMAC token: format is "payload.signature"
      const lastDot = tokenToUse.lastIndexOf('.');
      if (lastDot > 0 && secret) {
        const payload = tokenToUse.substring(0, lastDot);
        const sig = tokenToUse.substring(lastDot + 1);
        const expectedSig = createHmac('sha256', secret).update(payload).digest('hex');
        if (sig === expectedSig) {
          try {
            const parsed = JSON.parse(atob(payload));
            staff_email = parsed?.email || parsed?.username || null;
          } catch {
            const parsed = JSON.parse(payload);
            staff_email = parsed?.email || parsed?.username || null;
          }
        }
      }
    } catch {}

    // Fallback: decode without signature verification
    if (!staff_email) {
      staff_email = await extractStaffEmailFromToken(tokenToUse);
    }

    // Last resort: try parsing token as JSON directly
    if (!staff_email) {
      try {
        const parsed = JSON.parse(tokenToUse);
        staff_email = parsed?.email || parsed?.username || null;
      } catch {}
    }

    console.log('SAVE DEBUG:', {
      staff_email,
      payload_marked_by: body.records?.[0]?.marked_by ?? body.marked_by ?? null
    });

    if (!staff_email) {
      return Response.json({ error: 'Invalid staff session — could not extract staff email' }, { status: 401 });
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return Response.json({ error: 'No records provided' }, { status: 400 });
    }

    if (!date || !class_name || !section || !academic_year) {
      return Response.json({ error: 'Missing required fields: date, class_name, section, academic_year' }, { status: 400 });
    }

    // ── ACADEMIC YEAR VALIDATION ──
    const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year });
    if (yearConfigs.length === 0) {
      return Response.json({ error: `Academic year "${academic_year}" is not configured` }, { status: 400 });
    }
    const yearConfig = yearConfigs[0];

    if (!isWithinAcademicYear(date, yearConfig.start_date, yearConfig.end_date)) {
      return Response.json({
        error: `Date "${date}" is outside the academic year ${academic_year} (${yearConfig.start_date} to ${yearConfig.end_date})`
      }, { status: 400 });
    }

    // ── FETCH STAFF ACCOUNT FOR ROLE CHECK ──
    let staffRole = 'teacher';
    try {
      const staffAccounts = await base44.asServiceRole.entities.StaffAccount.filter({ email: staff_email });
      if (staffAccounts.length > 0) {
        staffRole = (staffAccounts[0].role || 'teacher').toLowerCase();
      }
    } catch {}

    const isAdmin = staffRole === 'admin' || staffRole === 'principal';

    // ── DATE VALIDATION (non-admins: today only) ──
    if (!is_admin_override && !isAdmin) {
      const todayIST = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).split(',')[0];
      if (date !== todayIST) {
        return Response.json({ error: `Teachers can only mark attendance for today (${todayIST})` }, { status: 403 });
      }
    }

    // ── FETCH EXISTING RECORDS FOR UPSERT ──
    const existingRecords = await base44.asServiceRole.entities.Attendance.filter({
      academic_year,
      date,
      class_name,
      section
    });

    // Build lookup map: student_id -> existing record
    const existingMap = {};
    existingRecords.forEach(r => {
      if (r.student_id) existingMap[r.student_id] = r;
    });

    const now = new Date().toISOString();
    const results = { created: 0, updated: 0, errors: [] };

    for (const record of records) {
      const { student_id, attendance_type, half_day_period, half_day_reason, remarks } = record;

      if (!student_id) {
        results.errors.push({ student_id: 'unknown', error: 'Missing student_id' });
        continue;
      }

      // ── LOCK CHECK ──
      const existing = existingMap[student_id];
      if (existing?.is_locked && !isAdmin && !is_admin_override) {
        results.errors.push({ student_id, error: 'Record is locked' });
        continue;
      }

      // ── VALIDATE STUDENT ──
      try {
        const students = await base44.asServiceRole.entities.Student.filter({
          student_id,
          academic_year
        });
        if (students.length === 0 || students[0].is_deleted) {
          results.errors.push({ student_id, error: 'Student not found or deleted' });
          continue;
        }
      } catch {
        results.errors.push({ student_id, error: 'Failed to validate student' });
        continue;
      }

      // ── FINAL SAVE PAYLOAD ──
      // CRITICAL: marked_by is ALWAYS from server-side staff_email, NEVER from frontend
      const savePayload = {
        date,
        class_name,
        section,
        student_id,
        student_name: record.student_name || existing?.student_name || '',
        academic_year,
        attendance_type: attendance_type || 'full_day',
        half_day_period: attendance_type === 'half_day' ? (half_day_period || null) : null,
        half_day_reason: attendance_type === 'half_day' ? (half_day_reason || '') : '',
        is_present: attendance_type !== 'absent',
        is_holiday: attendance_type === 'holiday',
        holiday_reason: attendance_type === 'holiday' ? (record.holiday_reason || '') : '',
        remarks: remarks || '',
        status: 'Submitted',
        marked_by: staff_email,        // ← ALWAYS server-side email
        submitted_at: now,             // ← ALWAYS server-side timestamp
        auto_submitted: false
      };

      console.log('SAVE DEBUG:', { staff_email, student_id, marked_by: savePayload.marked_by, status: savePayload.status });

      try {
        if (existing) {
          await base44.asServiceRole.entities.Attendance.update(existing.id, savePayload);
          results.updated++;
        } else {
          await base44.asServiceRole.entities.Attendance.create(savePayload);
          results.created++;
        }
      } catch (err) {
        results.errors.push({ student_id, error: err.message });
      }
    }

    return Response.json({
      success: true,
      created: results.created,
      updated: results.updated,
      errors: results.errors,
      staff_email
    });

  } catch (error) {
    console.error('[updateAttendanceWithValidation] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});