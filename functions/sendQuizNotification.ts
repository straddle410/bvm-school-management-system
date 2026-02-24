import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { quiz_id, class_name, title } = await req.json();

    if (!quiz_id || !class_name) {
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
      
      // Check if quiz notifications are enabled
      if (!pref || !pref.notifications_enabled || !pref.quiz_notifications) {
        continue;
      }

      // Create notification record
      await base44.asServiceRole.entities.Notification.create({
        recipient_student_id: student.student_id,
        type: 'quiz_posted',
        title: 'New Quiz Posted',
        message: `${title} - Check it out now!`,
        related_entity_id: quiz_id,
        is_read: false
      });

      notified++;
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in sendQuizNotification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});