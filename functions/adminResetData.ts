import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function hashValue(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Safely fetch all records for an entity with optional filter
async function fetchAll(sdk, entityName, filter = {}) {
  try {
    if (Object.keys(filter).length > 0) {
      return await sdk.entities[entityName].filter(filter) || [];
    }
    return await sdk.entities[entityName].list() || [];
  } catch { return []; }
}

// Delete records in batches
async function deleteRecords(sdk, entityName, records, dryRun) {
  if (dryRun) return records.length;
  let deleted = 0;
  for (const r of records) {
    try {
      await sdk.entities[entityName].delete(r.id);
      deleted++;
    } catch { /* skip locked/RLS-protected */ }
  }
  return deleted;
}

async function resetFees(sdk, academicYear, dryRun) {
  const counts = {};
  const filter = academicYear ? { academic_year: academicYear } : {};

  // 1. FeePayment (includes TRANSPORT_ADJUSTMENT)
  const payments = await fetchAll(sdk, 'FeePayment', filter);
  counts.FeePayment = await deleteRecords(sdk, 'FeePayment', payments, dryRun);

  // 2. StudentFeeDiscount
  const discounts = await fetchAll(sdk, 'StudentFeeDiscount', filter);
  counts.StudentFeeDiscount = await deleteRecords(sdk, 'StudentFeeDiscount', discounts, dryRun);

  // 3. AdditionalCharge
  const charges = await fetchAll(sdk, 'AdditionalCharge', filter);
  counts.AdditionalCharge = await deleteRecords(sdk, 'AdditionalCharge', charges, dryRun);

  // 4. FeeFamily
  const families = await fetchAll(sdk, 'FeeFamily', {});
  counts.FeeFamily = await deleteRecords(sdk, 'FeeFamily', families, dryRun);

  // 5. FeeInvoice (ANNUAL + ADHOC)
  const invoices = await fetchAll(sdk, 'FeeInvoice', filter);
  counts.FeeInvoice = await deleteRecords(sdk, 'FeeInvoice', invoices, dryRun);

  // 6. FeePlan
  const plans = await fetchAll(sdk, 'FeePlan', filter);
  counts.FeePlan = await deleteRecords(sdk, 'FeePlan', plans, dryRun);

  // 7. FeeHead (only if no academic year filter — these are school-wide)
  if (!academicYear) {
    const feeHeads = await fetchAll(sdk, 'FeeHead', {});
    counts.FeeHead = await deleteRecords(sdk, 'FeeHead', feeHeads, dryRun);
  }

  // 8. FeeReceiptConfig (school-wide, only if no year filter)
  if (!academicYear) {
    const receiptConfigs = await fetchAll(sdk, 'FeeReceiptConfig', {});
    counts.FeeReceiptConfig = await deleteRecords(sdk, 'FeeReceiptConfig', receiptConfigs, dryRun);
  }

  return counts;
}

async function resetAttendance(sdk, academicYear, dryRun) {
  const filter = academicYear ? { academic_year: academicYear } : {};
  const records = await fetchAll(sdk, 'Attendance', filter);
  return { Attendance: await deleteRecords(sdk, 'Attendance', records, dryRun) };
}

async function resetMarks(sdk, academicYear, dryRun) {
  const filter = academicYear ? { academic_year: academicYear } : {};
  const counts = {};
  const marks = await fetchAll(sdk, 'Marks', filter);
  counts.Marks = await deleteRecords(sdk, 'Marks', marks, dryRun);
  const examTypes = await fetchAll(sdk, 'ExamType', filter);
  counts.ExamType = await deleteRecords(sdk, 'ExamType', examTypes, dryRun);
  const timetables = await fetchAll(sdk, 'ExamTimetable', filter);
  counts.ExamTimetable = await deleteRecords(sdk, 'ExamTimetable', timetables, dryRun);
  const hallTickets = await fetchAll(sdk, 'HallTicket', filter);
  counts.HallTicket = await deleteRecords(sdk, 'HallTicket', hallTickets, dryRun);
  const progressCards = await fetchAll(sdk, 'ProgressCard', filter);
  counts.ProgressCard = await deleteRecords(sdk, 'ProgressCard', progressCards, dryRun);
  return counts;
}

async function resetContent(sdk, academicYear, dryRun) {
  const filter = academicYear ? { academic_year: academicYear } : {};
  const counts = {};
  const notices = await fetchAll(sdk, 'Notice', {});
  counts.Notice = await deleteRecords(sdk, 'Notice', notices, dryRun);
  const homework = await fetchAll(sdk, 'Homework', filter);
  counts.Homework = await deleteRecords(sdk, 'Homework', homework, dryRun);
  const diaries = await fetchAll(sdk, 'Diary', filter);
  counts.Diary = await deleteRecords(sdk, 'Diary', diaries, dryRun);
  const quizzes = await fetchAll(sdk, 'Quiz', filter);
  counts.Quiz = await deleteRecords(sdk, 'Quiz', quizzes, dryRun);
  const attempts = await fetchAll(sdk, 'QuizAttempt', {});
  counts.QuizAttempt = await deleteRecords(sdk, 'QuizAttempt', attempts, dryRun);
  return counts;
}

async function resetStudents(sdk, academicYear, dryRun) {
  const filter = academicYear ? { academic_year: academicYear } : {};
  const students = await fetchAll(sdk, 'Student', filter);
  return { Student: await deleteRecords(sdk, 'Student', students, dryRun) };
}

async function resetStaff(sdk, dryRun) {
  const staff = await fetchAll(sdk, 'StaffAccount', {});
  // Protect system/default accounts
  const deletable = staff.filter(s => s.username !== 'admin');
  return { StaffAccount: await deleteRecords(sdk, 'StaffAccount', deletable, dryRun) };
}

async function resetAcademicYears(sdk, dryRun) {
  const years = await fetchAll(sdk, 'AcademicYear', {});
  return { AcademicYear: await deleteRecords(sdk, 'AcademicYear', years, dryRun) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { modules = [], academicYear, dryRun = false, reset_token, record_id,
            confirmation_phrase, confirmation_school_name, confirmation_date, pre_reset_backup_id } = body;

    if (modules.length === 0) {
      return Response.json({ error: 'No modules selected' }, { status: 400 });
    }

    // Check school is test school
    const profiles = await base44.asServiceRole.entities.SchoolProfile.list();
    const profile = profiles[0];
    if (!profile?.is_test_school) {
      return Response.json({ error: 'Reset is disabled for production schools. Enable is_test_school in school profile first.' }, { status: 403 });
    }

    if (!dryRun) {
      // Validate reset_token
      if (!reset_token || !record_id) {
        return Response.json({ error: 'reset_token and record_id required for actual reset' }, { status: 400 });
      }

      const records = await base44.asServiceRole.entities.AdminResetLog.filter({ id: record_id });
      const otpRecord = records[0];
      if (!otpRecord || !otpRecord.otp_verified) {
        return Response.json({ error: 'OTP not verified. Please verify OTP first.' }, { status: 403 });
      }
      if (otpRecord.reset_token_used) {
        return Response.json({ error: 'Reset token already used.' }, { status: 403 });
      }
      if (new Date() > new Date(otpRecord.reset_token_expires_at)) {
        return Response.json({ error: 'Reset token expired. Please verify OTP again.' }, { status: 403 });
      }
      const tokenHash = await hashValue(reset_token);
      if (tokenHash !== otpRecord.reset_token_hash) {
        return Response.json({ error: 'Invalid reset token.' }, { status: 403 });
      }

      // Validate confirmations
      const today = new Date().toISOString().split('T')[0];
      if (confirmation_phrase !== 'RESET SCHOOL DATA') {
        return Response.json({ error: 'Confirmation phrase incorrect.' }, { status: 400 });
      }
      if (confirmation_school_name !== (profile?.school_name || '')) {
        return Response.json({ error: 'School name confirmation incorrect.' }, { status: 400 });
      }
      if (confirmation_date !== today) {
        return Response.json({ error: 'Date confirmation incorrect.' }, { status: 400 });
      }
    }

    const sdk = base44.asServiceRole;
    let allCounts = {};

    if (modules.includes('fees')) {
      Object.assign(allCounts, await resetFees(sdk, academicYear || null, dryRun));
    }
    if (modules.includes('attendance')) {
      Object.assign(allCounts, await resetAttendance(sdk, academicYear || null, dryRun));
    }
    if (modules.includes('marks')) {
      Object.assign(allCounts, await resetMarks(sdk, academicYear || null, dryRun));
    }
    if (modules.includes('content')) {
      Object.assign(allCounts, await resetContent(sdk, academicYear || null, dryRun));
    }
    if (modules.includes('students')) {
      Object.assign(allCounts, await resetStudents(sdk, academicYear || null, dryRun));
    }
    if (modules.includes('staff')) {
      Object.assign(allCounts, await resetStaff(sdk, dryRun));
    }
    if (modules.includes('academic_years')) {
      Object.assign(allCounts, await resetAcademicYears(sdk, dryRun));
    }

    // Save/update audit log
    if (!dryRun) {
      const records = await base44.asServiceRole.entities.AdminResetLog.filter({ id: record_id });
      const otpRecord = records[0];
      const today = new Date().toISOString().split('T')[0];
      await base44.asServiceRole.entities.AdminResetLog.update(otpRecord.id, {
        modules_selected: modules,
        academic_year_filter: academicYear || null,
        actual_deleted_counts: allCounts,
        is_dry_run: false,
        reset_token_used: true,
        otp_used: true,
        confirmation_phrase_ok: confirmation_phrase === 'RESET SCHOOL DATA',
        confirmation_schoolname_ok: confirmation_school_name === (profile?.school_name || ''),
        confirmation_date_ok: confirmation_date === today,
        pre_reset_backup_id: pre_reset_backup_id || null
      });
    } else {
      // Log dry run separately (create new record for dry-run previews)
      await base44.asServiceRole.entities.AdminResetLog.create({
        admin_user_id: user.email,
        timestamp: new Date().toISOString(),
        modules_selected: modules,
        academic_year_filter: academicYear || null,
        dry_run_preview_counts: allCounts,
        is_dry_run: true,
        otp_email_used: 'straddle410@gmail.com'
      });
    }

    return Response.json({
      success: true,
      dryRun,
      modules,
      academicYear: academicYear || null,
      counts: allCounts,
      totalDeleted: Object.values(allCounts).reduce((a, b) => a + b, 0)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});