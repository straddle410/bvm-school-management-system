import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Entity → RLS allows delete
const ALLOWED_ENTITIES = ['Attendance', 'Notice', 'Homework', 'Diary', 'Quiz', 'QuizAttempt', 'Marks', 'ExamType', 'ExamTimetable', 'HallTicket', 'ProgressCard', 'Student', 'FeePayment', 'FeeInvoice', 'StudentFeeDiscount', 'AdditionalCharge', 'FeeFamily', 'FeePlan', 'FeeHead', 'FeeReceiptConfig', 'AcademicYear', 'StaffAccount', 'AuditLog'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { entityName, filter = {}, reset_token, record_id } = body;

    if (!entityName || !ALLOWED_ENTITIES.includes(entityName)) {
      return Response.json({ error: `Entity "${entityName}" not allowed` }, { status: 400 });
    }

    // Validate reset token
    if (!reset_token || !record_id) {
      return Response.json({ error: 'Missing reset_token or record_id' }, { status: 400 });
    }
    const otpRecord = await base44.asServiceRole.entities.AdminResetLog.get(record_id).catch(() => null);
    if (!otpRecord || !otpRecord.reset_token || otpRecord.reset_token !== reset_token) {
      return Response.json({ error: 'Invalid or expired reset token' }, { status: 403 });
    }
    const tokenExpiry = new Date(otpRecord.reset_token_expires_at);
    if (Date.now() > tokenExpiry.getTime()) {
      return Response.json({ error: 'Reset token expired' }, { status: 403 });
    }

    // Delete all matching records in batches
    let totalDeleted = 0;
    const BATCH = 10;
    const MAX_ROUNDS = 200;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      let records;
      try {
        if (Object.keys(filter).length > 0) {
          records = await base44.asServiceRole.entities[entityName].filter(filter, null, 300) || [];
        } else {
          records = await base44.asServiceRole.entities[entityName].list(null, 300) || [];
        }
      } catch { break; }

      if (!records || records.length === 0) break;

      for (let i = 0; i < records.length; i += BATCH) {
        const batch = records.slice(i, i + BATCH);
        await Promise.allSettled(batch.map(r => base44.asServiceRole.entities[entityName].delete(r.id)));
        await sleep(80);
      }

      totalDeleted += records.length;
      if (records.length < 300) break;
      await sleep(200);
    }

    return Response.json({ success: true, entityName, deleted: totalDeleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});