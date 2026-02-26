import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'update' || !data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const marks = data;
    const student_id = marks.student_id;

    if (!student_id) {
      return Response.json({ error: 'Missing student_id' }, { status: 400 });
    }

    // Check for duplicate notification (DB-level)
    const existing = await base44.asServiceRole.entities.Notification.filter({
      recipient_student_id: student_id,
      type: 'results_posted',
      related_entity_id: marks.id,
    });

    if (existing.length > 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Create notification — no preference check, all students get it
    try {
      await base44.asServiceRole.entities.Notification.create({
        recipient_student_id: student_id,
        type: 'results_posted',
        title: 'Your Results Are Published',
        message: `${marks.subject} - ${marks.exam_type}`,
        related_entity_id: marks.id,
        action_url: '/Results',
        is_read: false,
      });
    } catch (err) {
      console.error('Failed to create notification:', err.message);
      return Response.json({ success: true, notified: 0 });
    }

    // Send push notification if enabled
    try {
      const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
        student_id: student_id
      });
      const pref = prefs[0];
      if (pref && pref.browser_push_enabled && pref.browser_push_token) {
        await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
          student_ids: [student_id],
          title: 'Your Results Are Published',
          message: `${marks.subject} - ${marks.exam_type}`,
          url: '/Results',
        });
      }
    } catch (pushErr) {
      console.error('Push send error (non-fatal):', pushErr.message);
    }

    return Response.json({ success: true, notified: 1 });
  } catch (error) {
    console.error('Error in notifyStudentsOnMarksPublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});