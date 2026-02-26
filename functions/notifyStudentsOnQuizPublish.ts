import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const quiz = data;
    const class_name = quiz.class_name;

    if (!class_name) {
      return Response.json({ error: 'Missing class_name' }, { status: 400 });
    }

    // Get all students in the class (Published = active in this school)
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: class_name,
      status: 'Published'
    });

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get notification preferences
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefMap = new Map(prefs.map(p => [p.student_id, p]));

    let notified = 0;
    const duplicateCheck = new Set();

    for (const student of students) {
      const duplicateKey = `quiz_${quiz.id}_${student.student_id}`;
      if (duplicateCheck.has(duplicateKey)) continue;
      duplicateCheck.add(duplicateKey);

      // Check for existing notification to avoid duplicates
      try {
        const existing = await base44.asServiceRole.entities.Notification.filter({
          recipient_student_id: student.student_id,
          related_entity_id: quiz.id,
          type: 'quiz_posted'
        });
        if (existing.length > 0) continue;
      } catch {}

      // Create in-app notification for ALL students (no pref gate for badge)
      try {
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: student.student_id,
          type: 'quiz_posted',
          title: 'New Quiz Posted',
          message: `${quiz.title} - ${quiz.subject}`,
          related_entity_id: quiz.id,
          action_url: '/Quiz',
          is_read: false
        });
        notified++;
      } catch (err) {
        console.error(`Failed to create notification for ${student.student_id}:`, err);
      }
    }

    // Also send push notifications
    if (notified > 0) {
      try {
        const studentIds = students
          .filter(s => {
            const p = prefMap.get(s.student_id);
            return p && p.notifications_enabled && p.quiz_notifications && p.browser_push_enabled && p.browser_push_token;
          })
          .map(s => s.student_id);

        if (studentIds.length > 0) {
          await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
            student_ids: studentIds,
            title: 'New Quiz Posted',
            message: `${quiz.title} - ${quiz.subject || ''}`,
            url: '/Quiz',
          });
        }
      } catch (pushErr) {
        console.error('Push send error (non-fatal):', pushErr.message);
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStudentsOnQuizPublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});