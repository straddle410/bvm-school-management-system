import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, event_types } = await req.json();

    if (!student_id || !event_types) {
      return Response.json({ 
        error: 'student_id and event_types (array) are required' 
      }, { status: 400 });
    }

    const eventArray = Array.isArray(event_types) ? event_types : [event_types];
    
    // Map event type names to notification type names
    const typeMap = {
      'DIARY_PUBLISHED': 'diary_published',
      'QUIZ_PUBLISHED': 'quiz_posted',
      'NOTICE_PUBLISHED': 'notice_posted',
      'HALLTICKET_PUBLISHED': 'hall_ticket_published',
    };

    let updated = 0;

    for (const eventType of eventArray) {
      const notifType = typeMap[eventType];
      if (!notifType) continue;

      // Fetch unread notifications for this student and type
      const notifications = await base44.entities.Notification.filter({
        recipient_student_id: student_id,
        type: notifType,
        is_read: false,
      }, null, 1000);

      // Mark each as read
      for (const notif of notifications) {
        await base44.entities.Notification.update(notif.id, { is_read: true });
        updated++;
      }
    }

    return Response.json({
      success: true,
      student_id,
      updated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});