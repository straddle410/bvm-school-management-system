import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process when status is Published (on create or update)
    if (!data || data.status !== 'Published') {
      return Response.json({ success: false, reason: 'Not a publish event' });
    }

    const diaryId = event.entity_id;
    const diary = data;

    // Get all students in the same class and section
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: diary.class_name,
      section: diary.section
    });

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    const notifications = students
      .filter(student => student.student_id)
      .map(student => ({
        recipient_student_id: student.student_id,
        recipient_name: student.name,
        type: 'diary_published',
        title: `New Class Activity: ${diary.subject}`,
        message: `${diary.posted_by_name || 'Teacher'} posted "${diary.title}" for ${diary.subject}.`,
        related_entity_id: diaryId,
        is_read: false,
        academic_year: diary.academic_year || student.academic_year
      }));

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    return Response.json({ success: true, notified: notifications.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});