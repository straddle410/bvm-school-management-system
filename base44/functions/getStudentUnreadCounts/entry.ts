import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id is required' }, { status: 400 });
    }

    // Count unread notifications for each type
    const allNotifications = await base44.entities.Notification.filter({
      recipient_student_id: student_id,
      is_read: false,
    }, null, 1000);

    const counts = {
      diary: 0,
      quiz: 0,
      notices: 0,
      hallTickets: 0,
      messages: 0,
    };

    // Group notifications by type
    allNotifications.forEach(n => {
      if (n.type === 'diary_published') counts.diary++;
      else if (n.type === 'quiz_posted') counts.quiz++;
      else if (n.type === 'notice_posted') counts.notices++;
      else if (n.type === 'hall_ticket_published') counts.hallTickets++;
    });

    // Count unread messages separately
    const unreadMessages = await base44.entities.Message.filter({
      recipient_id: student_id,
      is_read: false,
    }, null, 1000);
    counts.messages = unreadMessages.length;

    return Response.json({
      success: true,
      student_id,
      counts,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});