import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Entity automation payload: { event, data } OR direct flat record
    const body = await req.json();
    console.log('FEE RECEIPT FUNCTION TRIGGERED', body);

    // Log automation trigger
    const triggerRecord = body.data || body;
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'FEE_RECEIPT_TRIGGER',
      module: 'Fees',
      details: 'Function triggered',
      student_id: triggerRecord?.student_id,
      performed_by: 'AUTOMATION'
    });
    console.log('[sendFeePaymentNotification] Audit log created for trigger');

    // Support both wrapped { data: {...} } and flat record
    const record = body.data || body;

    if (!record || !record.student_id) {
      console.log('[sendFeePaymentNotification] No record data, skipping');
      return Response.json({ message: 'No record data, skipping' }, { status: 200 });
    }

    // Skip VOID / reversal entries
    if (record.status === 'VOID' || record.entry_type === 'REVERSAL') {
      console.log('[sendFeePaymentNotification] Skipping VOID/REVERSAL entry');
      return Response.json({ message: 'Skipping VOID/REVERSAL', status: 200 });
    }

    // 1. Get school name
    const schoolProfileList = await base44.asServiceRole.entities.SchoolProfile.list();
    const schoolName = (schoolProfileList?.[0]?.school_name || 'School').trim();

    // 2. Get student
    const students = await base44.asServiceRole.entities.Student.filter({ student_id: record.student_id });
    const student = students[0] || {};
    console.log('STUDENT DATA:', student);

    // 3. Get phone — try all known phone fields
    const rawPhone =
      student.parent_phone ||
      student.alternate_parent_phone ||
      student.father_phone ||
      student.mother_phone;

    let cleanPhone = (rawPhone || '').replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '91' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 12) {
      console.log('NO VALID PHONE:', student);
      return Response.json({ message: 'No valid phone number, skipping' }, { status: 200 });
    }

    // 4. Build public receipt link
    const receiptLink = `https://www.app.bvmse.in/receipt/${record.receipt_no}`;

    // 5. Format class_name as "5-A"
    const className = [record.class_name, student.section].filter(Boolean).join('-');

    // 6. Build exactly 5 variables
    const variables = [
      String(record.amount_paid),     // {{1}}
      String(record.student_name || student.name || 'Student'),    // {{2}}
      String(className || record.class_name || ''),              // {{3}}
      String(receiptLink),            // {{4}}
      String(schoolName)              // {{5}}
    ];

    // 7. Validation — strict check
    if (variables.length !== 5) {
      console.warn('[sendFeePaymentNotification] Variable count mismatch, skipping');
      return Response.json({ message: 'Variable count mismatch', status: 200 });
    }

    if (variables.some(v => !v || v === 'undefined')) {
      console.log('[sendFeePaymentNotification] INVALID VARIABLES:', variables);
      return Response.json({ message: 'Invalid variables, skipping' }, { status: 200 });
    }

    // 8. Final log
    console.log('[sendFeePaymentNotification] FINAL WA PAYLOAD:', {
      mobile: cleanPhone,
      variables,
      template: 'fee_recepit'
    });

    // 9. Send WhatsApp via service role
    const result = await base44.asServiceRole.functions.invoke('sendWhatsAppBulkMessage', {
      template_name: 'fee_recepit',
      recipients: [{ mobile: cleanPhone, variables }],
    });

    console.log('[sendFeePaymentNotification] Result:', result);
    return Response.json({ success: true, result });

  } catch (error) {
    console.error('FEE RECEIPT ERROR:', error);
    console.error('[sendFeePaymentNotification] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});