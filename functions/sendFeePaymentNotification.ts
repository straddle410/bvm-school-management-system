import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    console.log('[sendFeePaymentNotification] Event received:', event.type, 'PaymentID:', data?.id);

    // Only process create events
    if (event.type !== 'create') {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    const payment = data;
    console.log('[sendFeePaymentNotification] Processing payment:', payment.receipt_no, 'Amount:', payment.amount_paid);
    
    // Get student details
    const student = await base44.asServiceRole.entities.Student.filter({
      id: payment.student_id
    }).then(students => students[0]);
    
    console.log('[sendFeePaymentNotification] Student found:', student?.name);

    if (!student) {
      console.error('Student not found:', payment.student_id);
      return Response.json({ success: false, error: 'Student not found' });
    }

    // Get student notification preferences
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
      student_id: student.id
    });
    const pref = prefs[0];

    // Check if student has push notifications enabled
    if (!pref?.browser_push_enabled || !pref?.browser_push_token) {
      console.log('Student does not have push notifications enabled or no token available');
      return Response.json({ success: true, message: 'No push token available' });
    }

    // Construct notification message
    const message = {
      notification: {
        title: '✅ Fee Payment Received',
        body: `Payment of ₹${payment.amount_paid.toLocaleString()} received. Receipt: ${payment.receipt_no}`,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
      },
      data: {
        type: 'fee_payment',
        payment_id: payment.id,
        receipt_no: payment.receipt_no,
        student_id: student.id,
        amount: payment.amount_paid.toString(),
        click_action: `/StudentFees?receipt=${payment.receipt_no}`, // Deep link to receipt
      },
      token: pref.browser_push_token,
    };

    // Send FCM push notification
    const FCM_SERVER_KEY = Deno.env.get('FCM_SERVER_KEY');
    const FCM_PROJECT_ID = Deno.env.get('FCM_PROJECT_ID');

    if (!FCM_SERVER_KEY || !FCM_PROJECT_ID) {
      console.error('Missing FCM credentials');
      return Response.json({ success: false, error: 'Missing FCM credentials' });
    }

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

    if (!fcmResponse.ok) {
      const errorText = await fcmResponse.text();
      console.error('FCM error:', errorText);
      return Response.json({ success: false, error: 'FCM send failed', details: errorText });
    }

    // Log the notification in Message entity
    await base44.asServiceRole.entities.Message.create({
      sender_id: 'SYSTEM',
      sender_name: 'System',
      recipient_id: student.id,
      recipient_name: student.name,
      recipient_type: 'STUDENT',
      subject: 'Fee Payment',
      body: `Payment of ₹${payment.amount_paid.toLocaleString()} received. Receipt: ${payment.receipt_no}`,
      status: 'SENT',
      sent_at: new Date().toISOString(),
      message_type: 'FEE_PAYMENT_NOTIFICATION',
      metadata: {
        payment_id: payment.id,
        receipt_no: payment.receipt_no,
        amount_paid: payment.amount_paid,
      }
    });

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