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

    // Get student notification preferences
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
      student_id: student_id
    });

    const pref = prefs[0];

    // Check if notifications are enabled
    if (!pref || !pref.notifications_enabled) {
      return Response.json({ success: true, notified: 0 });
    }

    const duplicateKey = `marks_${marks.id}_${student_id}`;

    try {
      // Create notification record
      await base44.asServiceRole.entities.Notification.create({
        recipient_student_id: student_id,
        type: 'results_posted',
        title: 'Your Results Are Published',
        message: `${marks.subject} - ${marks.exam_type}`,
        related_entity_id: marks.id,
        action_url: '/Results',
        is_read: false,
        duplicate_key: duplicateKey
      });

      return Response.json({ success: true, notified: 1 });
    } catch (err) {
      console.error('Failed to create notification:', err);
      return Response.json({ success: true, notified: 0 });
    }
  } catch (error) {
    console.error('Error in notifyStudentsOnMarksPublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});