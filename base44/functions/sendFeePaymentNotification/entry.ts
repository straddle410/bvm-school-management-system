import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import axios from 'npm:axios@1.6.0';

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
    const receiptLink =
      "https://app.bvmse.in/receipt?receipt_no=" +
      encodeURIComponent(record.receipt_no);

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

    // 9. Send WhatsApp via MSG91 API
    const payload = {
      integrated_number: "919010724665",
      content_type: "template",
      payload: {
        messaging_product: "whatsapp",
        type: "template",
        template: {
          name: "fee_recepit",
          language: {
            code: "te",
            policy: "deterministic"
          },
          namespace: "6a70912b_12e8_4bbe_9e14_f1f979c61040",
          to_and_components: [
            {
              to: [cleanPhone],
              components: {
                body_1: { type: "text", value: variables[0] },
                body_2: { type: "text", value: variables[1] },
                body_3: { type: "text", value: variables[2] },
                body_4: { type: "text", value: variables[3] },
                body_5: { type: "text", value: variables[4] }
              }
            }
          ]
        }
      }
    };

    console.log('FINAL MSG91 PAYLOAD:', payload);

    const result = await axios.post(
      'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          authkey: Deno.env.get('MSG91_AUTH_KEY')
        }
      }
    );

    console.log('[sendFeePaymentNotification] Result:', result.data);
    return Response.json({ success: true, result: result.data });

  } catch (error) {
    console.error('FEE RECEIPT ERROR:', error);
    console.error('[sendFeePaymentNotification] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});