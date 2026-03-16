import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    console.log('[FCM] Function started!');
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    console.log('[FCM] Function called with:', data?.student_id, data?.amount_paid);
    console.log('[sendFeePaymentNotification] Event received:', event.type, 'PaymentID:', data?.id);

    // Only process create events
    if (event.type !== 'create') {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    const payment = data;
    console.log('[FCM] Payment object:', JSON.stringify(payment));
    console.log('[sendFeePaymentNotification] Processing payment:', payment.receipt_no, 'Amount:', payment.amount_paid);
    
    // Get student details - try both student_id and id fields
    console.log('[FCM] Looking up student with:', payment.student_id, 'PaymentID:', payment.id);
    const studentId = payment.student_id;
    
    let student = null;
    if (studentId) {
      const results = await base44.asServiceRole.entities.Student.filter({
        student_id: studentId
      });
      student = results[0];
    }
    
    if (!student) {
      const results = await base44.asServiceRole.entities.Student.filter({
        id: studentId
      });
      student = results[0];
    }
    
    console.log('[sendFeePaymentNotification] Student found:', student?.name, 'ID:', student?.id, 'student_id:', student?.student_id);

    if (!student) {
      console.error('Student not found:', payment.student_id);
      return Response.json({ success: false, error: 'Student not found' });
    }

    // Get student notification preferences using student_id field (e.g., "S25007")
    console.log('[FCM] Searching preference for student.student_id:', student?.student_id);
    
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
      student_id: student.student_id
    });
    
    const pref = prefs[0];
    console.log('[FCM] Pref found:', JSON.stringify(pref));
    console.log('[FCM] Token:', pref?.browser_push_token);

    // Check if student has push notifications enabled
    if (!pref?.browser_push_enabled || !pref?.browser_push_token) {
      console.log('[sendFeePaymentNotification] Student does not have push notifications enabled or no token available');
      return Response.json({ success: true, message: 'No push token available' });
    }
    
    console.log('[sendFeePaymentNotification] Student push token found:', pref.browser_push_token?.substring(0, 50) + '...');
    console.log('[sendFeePaymentNotification] Student has push token, preparing FCM message');

    // Use Web Push (VAPID) to send to the stored endpoint
    // The token stored is a Web Push subscription endpoint URL
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

    console.log('[sendFeePaymentNotification] VAPID keys present:', !!VAPID_PUBLIC_KEY, !!VAPID_PRIVATE_KEY);

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error('[sendFeePaymentNotification] Missing VAPID credentials');
      return Response.json({ success: false, error: 'Missing VAPID credentials' });
    }

    // The browser_push_token is a raw Web Push endpoint URL
    // Parse it into a subscription object
    let subscription;
    try {
      // Try parsing as JSON first (full subscription object)
      subscription = JSON.parse(pref.browser_push_token);
    } catch {
      // It's a raw endpoint URL — can't send without keys, log and skip
      console.error('[sendFeePaymentNotification] browser_push_token is a raw endpoint URL, not a full subscription object. Re-registration needed.');
      return Response.json({ success: false, error: 'Subscription token is a raw endpoint, not a full Web Push subscription. Student must re-enable notifications.' });
    }

    const webpush = await import('npm:web-push@3.6.7');
    webpush.default.setVapidDetails(
      'mailto:admin@school.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const receiptUrl = `https://bvmse.in/StudentDashboard?openFees=1&receiptNo=${payment.receipt_no}`;
    const payload = JSON.stringify({
      title: '✅ Fee Payment Received',
      body: `Payment of ₹${payment.amount_paid.toLocaleString()} received. Receipt: ${payment.receipt_no}`,
      data: { url: receiptUrl },
      click_action: receiptUrl,
    });

    console.log('[sendFeePaymentNotification] Sending Web Push notification...');
    await webpush.default.sendNotification(subscription, payload);
    console.log('[sendFeePaymentNotification] Web Push sent successfully');

    return Response.json({ 
      success: true, 
      message: 'Notification sent successfully',
      student_id: student.id,
      receipt_no: payment.receipt_no
    });

  } catch (error) {
    console.error('Error sending fee payment notification:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});