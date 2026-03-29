import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function hashValue(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fetch one page of records
async function fetchPage(sdk, entityName, filter = {}) {
  try {
    if (Object.keys(filter).length > 0) {
      return await sdk.entities[entityName].filter(filter, null, 300) || [];
    }
    return await sdk.entities[entityName].list(null, 300) || [];
  } catch { return []; }
}

// Delete ALL records by repeatedly fetching + deleting until none remain
async function deleteAllRecords(sdk, entityName, filter = {}, dryRun) {
  if (dryRun) {
    // For dry run just count
    const page = await fetchPage(sdk, entityName, filter);
    return page.length; // approximate
  }
  let totalDeleted = 0;
  const MAX_ROUNDS = 100; // safety cap
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const records = await fetchPage(sdk, entityName, filter);
    if (!records || records.length === 0) break;
    const BATCH = 20;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      await Promise.allSettled(batch.map(r => sdk.entities[entityName].delete(r.id)));
    }
    totalDeleted += records.length;
    if (records.length < 300) break; // last page
  }
  return totalDeleted;
}

// Delete records in parallel batches of 20
async function deleteRecords(sdk, entityName, records, dryRun) {
  if (dryRun) return records.length;
  let deleted = 0;
  const BATCH = 20;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(r => sdk.entities[entityName].delete(r.id)));
    deleted += results.filter(r => r.status === 'fulfilled').length;
  }
  return deleted;
}

async function resetFees(sdk, academicYear, dryRun) {
  const counts = {};
  const filter = academicYear ? { academic_year: academicYear } : {};

  counts.FeePayment = await deleteAllRecords(sdk, 'FeePayment', filter, dryRun);
  counts.StudentFeeDiscount = await deleteAllRecords(sdk, 'StudentFeeDiscount', filter, dryRun);
  counts.AdditionalCharge = await deleteAllRecords(sdk, 'AdditionalCharge', filter, dryRun);
  counts.FeeFamily = await deleteAllRecords(sdk, 'FeeFamily', {}, dryRun);
  counts.FeeInvoice = await deleteAllRecords(sdk, 'FeeInvoice', filter, dryRun);
  counts.FeePlan = await deleteAllRecords(sdk, 'FeePlan', filter, dryRun);
  if (!academicYear) {
    counts.FeeHead = await deleteAllRecords(sdk, 'FeeHead', {}, dryRun);
    counts.FeeReceiptConfig = await deleteAllRecords(sdk, 'FeeReceiptConfig', {}, dryRun);
  }
  return counts;
}

async function resetAttendance(sdk, academicYear, dryRun) {
  const filter = academicYear ? { academic_year: academicYear } : {};
  return { Attendance: await deleteAllRecords(sdk, 'Attendance', filter, dryRun) };
}

async function resetMarks(sdk, academicYear, dryRun) {
  const filter = academicYear ? { academic_year: academicYear } : {};
  const counts = {};
  counts.Marks = await deleteAllRecords(sdk, 'Marks', filter, dryRun);
  counts.ExamType = await deleteAllRecords(sdk, 'ExamType', filter, dryRun);
  counts.ExamTimetable = await deleteAllRecords(sdk, 'ExamTimetable', filter, dryRun);
  counts.HallTicket = await deleteAllRecords(sdk, 'HallTicket', filter, dryRun);
  counts.ProgressCard = await deleteAllRecords(sdk, 'ProgressCard', filter, dryRun);
  return counts;
}

async function resetContent(sdk, academicYear, dryRun) {
  const filter = academicYear ? { academic_year: academicYear } : {};
  const counts = {};
  counts.Notice = await deleteAllRecords(sdk, 'Notice', {}, dryRun);
  counts.Homework = await deleteAllRecords(sdk, 'Homework', filter, dryRun);
  counts.Diary = await deleteAllRecords(sdk, 'Diary', filter, dryRun);
  counts.Quiz = await deleteAllRecords(sdk, 'Quiz', filter, dryRun);
  counts.QuizAttempt = await deleteAllRecords(sdk, 'QuizAttempt', {}, dryRun);
  return counts;
}

async function resetStudents(sdk, academicYear, dryRun) {
  const filter = academicYear ? { academic_year: academicYear } : {};
  return { Student: await deleteAllRecords(sdk, 'Student', filter, dryRun) };
}

async function resetStaff(sdk, dryRun) {
  // Fetch all then filter out admin, then delete by ID list
  const staff = await fetchPage(sdk, 'StaffAccount', {});
  const deletable = staff.filter(s => s.username !== 'admin');
  if (dryRun) return { StaffAccount: deletable.length };
  let deleted = 0;
  for (const s of deletable) {
    try { await sdk.entities.StaffAccount.delete(s.id); deleted++; } catch {}
  }
  return { StaffAccount: deleted };
}

async function resetAcademicYears(sdk, dryRun) {
  return { AcademicYear: await deleteAllRecords(sdk, 'AcademicYear', {}, dryRun) };
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