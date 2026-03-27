import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Entity automation payload: { event, data } OR direct flat record
    const body = await req.json();
    console.log('FEE RECEIPT FUNCTION TRIGGERED', body);
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

    // 3. Get phone — only digits, must start with 91
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

    // 4. Build receipt link — full URL using BASE44_APP_ID
    const appId = Deno.env.get('BASE44_APP_ID') || '';
    const baseUrl = appId ? `https://app-${appId}.base44.app` : '';
    if (!baseUrl) {
      console.log('[sendFeePaymentNotification] Cannot determine app base URL, skipping');
      return Response.json({ message: 'No base URL, skipping' }, { status: 200 });
    }
    const receiptLink = `${baseUrl}/PrintReceiptA5?paymentId=${record.id}`;

    // 5. Format class_name as "5-A"
    const className = [record.class_name, student.section].filter(Boolean).join('-');

    // 6. Build exactly 5 variables
    const variables = [
      String(record.amount_paid || 0).trim(),   // {{1}} amount_paid
      (record.student_name || student.name || 'Student').trim(), // {{2}} student_name
      (className || record.class_name || '').trim(), // {{3}} class_name
      receiptLink.trim(),                        // {{4}} receiptLink
      schoolName,                                // {{5}} schoolName
    ];

    // 7. Validation — skip if any variable is empty
    const emptyIdx = variables.findIndex(v => !v || v.trim() === '');
    if (emptyIdx !== -1) {
      console.warn(`[sendFeePaymentNotification] Empty variable at index ${emptyIdx}, skipping`, variables);
      return Response.json({ message: `Empty variable at index ${emptyIdx}, skipping` }, { status: 200 });
    }

    // 8. Debug log
    console.log('FEE RECEIPT WA:', { phone, variables });
    console.log('FEE RECEIPT PAYLOAD:', { phone, variables, template_id: 'fee_receipt' });

    // 9. Send WhatsApp
    const result = await base44.asServiceRole.functions.invoke('sendWhatsAppBulkMessage', {
      template_id: 'fee_receipt',
      use_case: 'FeeReminder',
      recipients: [{ student_id: record.student_id, phone, variables }],
    });

    console.log('FEE RECEIPT RESPONSE:', result);
    console.log('[sendFeePaymentNotification] Result:', result);
    return Response.json({ success: true, result });

  } catch (error) {
    console.error('FEE RECEIPT ERROR:', error);
    console.error('[sendFeePaymentNotification] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});