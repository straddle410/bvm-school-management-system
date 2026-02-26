import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process if status = "Published"
    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const hallTicket = data;
    const student_id = hallTicket.student_id;
    const academicYear = hallTicket.academic_year;

    if (!student_id || !academicYear) {
      return Response.json({ error: 'Missing student_id or academic_year' }, { status: 400 });
    }

    // Create Notification for student
    try {
      const duplicateKey = `hall_ticket_${hallTicket.id}_${student_id}`;
      
      const notification = await base44.asServiceRole.entities.Notification.create({
        recipient_student_id: student_id,
        type: 'hall_ticket_published',
        title: 'Hall Ticket Published',
        message: `Your exam hall ticket for ${hallTicket.exam_type || 'Exam'} is now available`,
        related_entity_id: hallTicket.id,
        action_url: '/StudentHallTicketView',
        is_read: false,
        duplicate_key: duplicateKey,
        academic_year: academicYear
      });

      // Send push notification if enabled
      try {
        const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
          student_id: student_id
        });

        if (prefs.length > 0 && prefs[0].browser_push_enabled && prefs[0].browser_push_token) {
          await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
            student_ids: [student_id],
            title: 'Hall Ticket Ready',
            message: `Your exam hall ticket is now available. Download and print it.`,
            url: '/StudentHallTicketView'
          });
        }
      } catch (pushErr) {
        console.warn('Push notification error (non-fatal):', pushErr.message);
      }

      return Response.json({ success: true, notified: 1, notificationId: notification.id });
    } catch (err) {
      if (err.message?.includes('duplicate')) {
        console.warn(`Duplicate notification for student ${student_id}, ignoring`);
        return Response.json({ success: true, notified: 0, message: 'Duplicate prevention triggered' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Error in notifyStudentsOnHallTicketPublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});