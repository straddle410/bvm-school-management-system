import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const { recipientEmails, application, action, performedBy } = await req.json();

    if (!recipientEmails || !application || !action) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    const actionMessages = {
      'VERIFIED': `Application verified by ${performedBy}. Awaiting approval.`,
      'APPROVED': `Application approved. Ready for conversion to student record.`,
      'REJECTED': `Application rejected by ${performedBy}.`
    };

    const message = actionMessages[action] || 'Application status updated.';

    // Send notification to each recipient
    const notificationPromises = recipientEmails.map(email =>
      base44.asServiceRole.entities.Notification.create({
        recipient_email: email,
        type: 'ADMISSION',
        title: `Admission Application: ${application.student_name}`,
        body: message,
        details: {
          application_no: application.application_no,
          student_name: application.student_name,
          applying_for_class: application.applying_for_class,
          status: application.status,
          action: action,
          performed_by: performedBy,
          timestamp: new Date().toISOString()
        },
        application_id: application.id,
        is_read: false,
        created_at: new Date().toISOString()
      }).catch(() => null) // Soft fail if notification creation fails
    );

    await Promise.all(notificationPromises);

    return Response.json({ 
      success: true, 
      notificationsCount: recipientEmails.length 
    }, { status: 200 });

  } catch (error) {
    console.error('Notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});