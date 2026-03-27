import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Entity automation payload: { event, data }
    const body = await req.json();
    const record = body.data;

    if (!record || !record.student_id) {
      return Response.json({ message: 'No record data, skipping' }, { status: 200 });
    }

    // 1. Get school name
    const schoolProfileList = await base44.asServiceRole.entities.SchoolProfile.list();
    const schoolName = schoolProfileList?.[0]?.school_name || 'School';

    // 2. Get student
    const students = await base44.asServiceRole.entities.Student.filter({ student_id: record.student_id });
    const student = students[0] || {};

    // 3. Get phone
    const rawPhone = student.parent_phone || student.alternate_parent_phone;
    if (!rawPhone) {
      console.log(`[sendFeePaymentNotification] No phone for student ${record.student_id}, skipping`);
      return Response.json({ message: 'No phone number, skipping' }, { status: 200 });
    }

    const digits = rawPhone.replace(/\D/g, '');
    if (digits.length < 10) {
      console.log(`[sendFeePaymentNotification] Invalid phone ${rawPhone}, skipping`);
      return Response.json({ message: 'Invalid phone number, skipping' }, { status: 200 });
    }
    const phone = digits.startsWith('91') ? digits : `91${digits}`;

    // 4. Build receipt link
    const receiptLink = `/PrintReceiptA5?paymentId=${record.id}`;

    // 5. Build variables matching template placeholders (MUST use 'variables' key)
    const variables = [
      (record.student_name || 'Student').toString().trim(),           // {{1}}
      (record.class_name || 'Class').toString().trim(),              // {{2}}
      String(record.amount_paid || 0).trim(),                        // {{3}}
      (record.payment_date || new Date().toISOString().slice(0, 10)).trim(), // {{4}}
      receiptLink.trim(),                                            // {{5}}
      schoolName.trim(),                                             // {{6}}
    ];

    if (variables.some(v => !v || v.toString().trim() === '')) {
      console.error('[sendFeePaymentNotification] Invalid variables:', variables);
      return Response.json({ message: 'Invalid template variables, skipping' }, { status: 200 });
    }

    // 6. Send WhatsApp
    console.log(`[sendFeePaymentNotification] Sending to ${phone} for student ${record.student_name}`);
    const result = await base44.asServiceRole.functions.invoke('sendWhatsAppBulkMessage', {
      template_id: 'fee_receipt',
      use_case: 'FeeReminder',
      recipients: [{ student_id: studentId, phone, variables }],
    });

    console.log('[sendFeePaymentNotification] Result:', result);
    return Response.json({ success: true, result });

  } catch (error) {
    console.error('[sendFeePaymentNotification] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});