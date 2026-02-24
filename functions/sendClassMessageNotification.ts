import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { message_id, class_name, subject, body, sender_name } = await req.json();

    if (!message_id || !class_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get all students in the class
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: class_name,
      status: 'Published' // Only active students
    });

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get notification preferences for all students
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefMap = new Map(prefs.map(p => [p.student_id, p]));

    let notified = 0;

    // Send push notifications to eligible students
    for (const student of students) {
      const pref = prefMap.get(student.student_id);
      
      // Check if notifications are enabled
      if (!pref || !pref.notifications_enabled || !pref.message_notifications) {
        continue;
      }

      // Create notification record
      await base44.asServiceRole.entities.Notification.create({
        recipient_student_id: student.student_id,
        type: 'class_message',
        title: `Message from ${sender_name}`,
        message: subject || body.substring(0, 100),
        related_entity_id: message_id,
        is_read: false
      });

      notified++;

      // Send browser push if token exists and enabled
      if (pref.browser_push_token && pref.browser_push_enabled) {
        try {
          // Browser notification will be handled by service worker on client
          // This is just for logging/tracking
        } catch (err) {
          console.error(`Failed to send push to student ${student.student_id}:`, err);
        }
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in sendClassMessageNotification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});