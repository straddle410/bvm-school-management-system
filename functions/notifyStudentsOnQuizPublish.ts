import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event?.type !== 'update' || data?.status !== 'Published') {
      return Response.json({ success: false, message: 'Not a publish event' });
    }

    const quiz = data;
    if (!quiz.id) {
      return Response.json({ success: false, message: 'No quiz ID' });
    }

    const students = await base44.asServiceRole.entities.Student.list();
    const notifications = students.map(student => ({
      recipient_student_id: student.student_id,
      recipient_name: student.name,
      type: 'quiz_posted',
      title: quiz.title,
      message: `New quiz: ${quiz.title}`,
      related_entity_id: quiz.id,
      is_read: false,
      academic_year: student.academic_year
    }));

    if (notifications.length > 0) {
      await base44.asServiceRole.entities.Notification.bulkCreate(notifications);
    }

    return Response.json({ success: true, created: notifications.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});