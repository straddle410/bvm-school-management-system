import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process create events
    if (event.type !== 'create') {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    const payment = data;
    const receiptNo = payment.receipt_no;

    // Load NotificationSettings
    const settingsList = await base44.asServiceRole.entities.NotificationSettings.list();
    const settings = settingsList[0];

    if (!settings || settings.enable_push !== true) {
      console.log('[sendFeePaymentNotification] Push disabled or settings missing, skipping notification.');
      return Response.json({ success: true, message: 'Push notifications disabled' });
    }

    if (!receiptNo || payment.notification_sent) {
      console.log('[sendFeePaymentNotification] Skip: no receipt or already notified');
      return Response.json({ success: true, message: 'Skipped' });
    }

    // Use student data directly from payment (no lookup query)
    const studentId = payment.student_id;
    const studentName = payment.student_name || 'Student';
    
    if (!studentId) {
      console.error('[sendFeePaymentNotification] No student_id in payment');
      return Response.json({ success: false, error: 'No student_id' });
    }

    const amountStr = payment.amount_paid ? `₹${Number(payment.amount_paid).toLocaleString()}` : '';
    const profilesList = await base44.asServiceRole.entities.SchoolProfile.list();
    const schoolName = (profilesList[0] || {}).school_name || 'School';
    const paymentTemplate = settings.fee_payment_template ||
      `Payment of {{amount}} received for {{student_name}}. Receipt No: {{receipt_no}}.`;
    const subject = '✅ Fee Payment Received';
    const body = paymentTemplate
      .replace(/{{amount}}/g, amountStr)
      .replace(/{{student_name}}/g, studentName)
      .replace(/{{receipt_no}}/g, receiptNo)
      .replace(/{{school_name}}/g, schoolName);
    const academicYear = payment.academic_year || '2024-25';

    // Send consolidated push via OneSignal
    let isPushSent = false;
    let oneSignalId = 'unknown';
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    
    try {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          app_id: ONESIGNAL_APP_ID,
          include_external_user_ids: [`student_${studentId}`],
          contents: { en: body },
          headings: { en: subject },
        }),
      });
      const osData = await res.json();
      
      if (res.ok) {
        isPushSent = true;
        oneSignalId = osData.id || 'unknown';
        console.log('[sendFeePaymentNotification] OneSignal sent for:', studentId);
        // Log success
        await base44.asServiceRole.entities.PushNotificationLog.create({
          one_signal_notification_id: oneSignalId,
          target_type: 'student',
          target_user_ids: [`student_${studentId}`],
          title: subject,
          message: body.substring(0, 100),
          recipients_count: osData.recipients || 1,
          status: 'sent',
          context_type: 'fee_payment',
          context_id: receiptNo,
          sent_date: new Date().toISOString(),
        });
      } else {
        console.error(`[sendFeePaymentNotification] OneSignal failed (${res.status}):`, JSON.stringify(osData));
        // Log failure
        await base44.asServiceRole.entities.PushNotificationLog.create({
          one_signal_notification_id: osData.id || 'unknown',
          target_type: 'student',
          target_user_ids: [`student_${studentId}`],
          title: subject,
          message: body.substring(0, 100),
          recipients_count: 1,
          status: 'failed',
          error_message: osData.errors?.[0] || JSON.stringify(osData),
          context_type: 'fee_payment',
          context_id: receiptNo,
          sent_date: new Date().toISOString(),
        });
      }
    } catch (pushErr) {
      console.warn('[sendFeePaymentNotification] OneSignal network error:', pushErr.message);
      // Log network failure
      await base44.asServiceRole.entities.PushNotificationLog.create({
        one_signal_notification_id: 'network_error',
        target_type: 'student',
        target_user_ids: [`student_${studentId}`],
        title: subject,
        message: body.substring(0, 100),
        recipients_count: 1,
        status: 'failed',
        error_message: pushErr.message,
        context_type: 'fee_payment',
        context_id: receiptNo,
        sent_date: new Date().toISOString(),
      });
    }

    // Create Message + mark payment as notified (dual-write for safety)
    await Promise.all([
      base44.asServiceRole.entities.Message.create({
        sender_id: 'system',
        sender_name: 'School',
        sender_role: 'admin',
        recipient_type: 'individual',
        recipient_id: studentId,
        recipient_name: studentName,
        subject,
        body,
        is_read: false,
        academic_year: academicYear,
        context_type: 'fee_payment',
        context_id: receiptNo,
        is_push_sent: isPushSent,
      }),
      base44.asServiceRole.entities.FeePayment.update(payment.id, {
        notification_sent: true
      })
    ]);

    return Response.json({ success: true, receipt_no: receiptNo, student_id: studentId });
  } catch (error) {
    console.error('[sendFeePaymentNotification] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});