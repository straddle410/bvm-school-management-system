import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, event_types } = await req.json();

    if (!student_id || !event_types) {
      return Response.json({ error: 'student_id and event_types (array) are required' }, { status: 400 });
    }

    // Legacy uppercase keys → actual DB type values.
    // Also accepts actual type strings directly (e.g. 'notice_posted').
    const typeMap = {
      'DIARY_PUBLISHED':     'diary_published',
      'QUIZ_PUBLISHED':      'quiz_posted',
      'NOTICE_PUBLISHED':    'notice_posted',
      'HALLTICKET_PUBLISHED':'hall_ticket_published',
      'CLASS_MESSAGE':       'class_message',
      'HOMEWORK_PUBLISHED':  'homework_published',
      'MARKS_PUBLISHED':     'marks_published',
      'RESULTS_POSTED':      'results_posted',
    };

    const eventArray = Array.isArray(event_types) ? event_types : [event_types];
    let updated = 0;

    for (const raw of eventArray) {
      const notifType = typeMap[raw] || raw; // fallback: treat as direct type string

      const notifications = await base44.asServiceRole.entities.Notification.filter({
        recipient_student_id: student_id,
        type: notifType,
        is_read: false,
      }, null, 1000);

      for (const notif of notifications) {
        await base44.asServiceRole.entities.Notification.update(notif.id, { is_read: true });
        updated++;
      }
    }

    return Response.json({ success: true, student_id, updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});