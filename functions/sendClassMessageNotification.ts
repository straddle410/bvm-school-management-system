import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { message_id, class_name, subject, body, sender_name } = await req.json();

    if (!message_id || !class_name) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get all students in the class (Published = active in this school)
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: class_name,
      status: 'Published'
    });

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get notification preferences for all students
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefMap = new Map(prefs.map(p => [p.student_id, p]));

    let notified = 0;
    const duplicateCheck = new Set();

    // Send push notifications to eligible students
    for (const student of students) {
      const pref = prefMap.get(student.student_id);
      
      // Check if notifications are enabled
      if (!pref || !pref.notifications_enabled || !pref.message_notifications) {
        continue;
      }

      // Prevent duplicate notifications
      const duplicateKey = `message_${message_id}_${student.student_id}`;
      if (duplicateCheck.has(duplicateKey)) {
        console.warn(`Skipping duplicate notification for ${student.student_id}`);
        continue;
      }
      duplicateCheck.add(duplicateKey);

      try {
        // Create notification record with deduplication key and action URL
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: student.student_id,
          type: 'class_message',
          title: `Message from ${sender_name}`,
          message: subject || body.substring(0, 100),
          related_entity_id: message_id,
          action_url: '/StudentMessaging',
          is_read: false,
          duplicate_key: duplicateKey
        });

        notified++;
      } catch (err) {
        console.error(`Failed to create notification for student ${student.student_id}:`, err);
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in sendClassMessageNotification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});