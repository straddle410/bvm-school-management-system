import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const diary = data;
    const class_name = diary.class_name;
    const section = diary.section || 'A';

    // Get all students in the class
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: class_name,
      section: section,
      status: 'Approved'
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
      const pref = prefMap.get(student.student_id);

      if (!pref || !pref.notifications_enabled) {
        continue;
      }

      const duplicateKey = `diary_${diary.id}_${student.student_id}`;
      if (duplicateCheck.has(duplicateKey)) {
        continue;
      }
      duplicateCheck.add(duplicateKey);

      try {
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: student.student_id,
          type: 'diary_published',
          title: 'Class Diary Published',
          message: diary.title || `Class diary for ${diary.date}`,
          related_entity_id: diary.id,
          action_url: '/Diary',
          is_read: false,
          duplicate_key: duplicateKey
        });

        notified++;
      } catch (err) {
        console.error(`Failed to create notification for ${student.student_id}:`, err);
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStudentsOnDiaryPublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});