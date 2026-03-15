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

    // Construct notification message (data-only so Android uses service worker)
    const message = {
      data: {
        title: '✅ Fee Payment Received',
        body: `Payment of ₹${payment.amount_paid.toLocaleString()} received. Receipt: ${payment.receipt_no}`,
        type: 'fee_payment',
        payment_id: String(payment.id || ''),
        receipt_no: String(payment.receipt_no || ''),
        student_id: String(student.student_id || ''),
        amount: String(payment.amount_paid || ''),
        click_action: `/StudentFees?receipt=${payment.receipt_no}`,
        timestamp: new Date().toISOString(),
      },
      token: pref.browser_push_token,
    };

    // Send FCM push notification
    const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
    const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID');

    console.log('[sendFeePaymentNotification] FCM ProjectID:', FCM_PROJECT_ID ? FCM_PROJECT_ID.substring(0, 20) + '...' : 'MISSING');
    console.log('[sendFeePaymentNotification] FCM ServerKey:', FCM_SERVER_KEY ? 'SET' : 'MISSING');

    if (!FCM_SERVER_KEY || !FCM_PROJECT_ID) {
      console.error('[sendFeePaymentNotification] Missing FCM credentials');
      return Response.json({ success: false, error: 'Missing FCM credentials' });
    }

    console.log('[sendFeePaymentNotification] Sending FCM message via FCM API...');
    console.log('[sendFeePaymentNotification] FCM Endpoint:', `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`);
    console.log('[sendFeePaymentNotification] Message payload:', JSON.stringify({ message }, null, 2));
    
    const fcmResponse = await fetch(
      `https://fcm.googleapis.com/v1/projects/${FCM_PROJECT_ID}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FCM_SERVER_KEY}`,
        },
        body: JSON.stringify({ message }),
      }
    );

    console.log('[sendFeePaymentNotification] FCM Response Status:', fcmResponse.status);
    const responseText = await fcmResponse.text();
    console.log('[sendFeePaymentNotification] FCM Response Body:', responseText);
    console.log('[FCM] FCM API response:', JSON.stringify({ status: fcmResponse.status, body: responseText }));

    if (!fcmResponse.ok) {
      console.error('[sendFeePaymentNotification] FCM error:', fcmResponse.status, responseText);
      return Response.json({ success: false, error: 'FCM send failed', details: responseText });
    }

    console.log('[sendFeePaymentNotification] FCM message sent successfully');

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