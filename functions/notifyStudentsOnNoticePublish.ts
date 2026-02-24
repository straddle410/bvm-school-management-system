import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Trigger on both create and update when status is Published
    if (!data || data.status !== 'Published') {
      return Response.json({ success: false, message: 'Not a publish event' });
    }

    const notice = data;
    const noticeId = event.entity_id;

    // Get all students (notice goes to everyone)
    const students = await base44.asServiceRole.entities.Student.list();
    const notifications = students
      .filter(student => student.student_id)
      .map(student => ({
        recipient_student_id: student.student_id,
        recipient_name: student.name,
        type: 'notice_posted',
        title: notice.title,
        message: `New notice: ${notice.title}`,
        related_entity_id: noticeId,
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