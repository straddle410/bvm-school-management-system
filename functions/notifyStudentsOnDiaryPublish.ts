import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process Published updates
    if (event.type !== 'update' || !data || data.status !== 'Published') {
      return Response.json({ success: false, reason: 'Not a publish event' });
    }

    const diaryId = event.entity_id;
    const diary = data;

    // Get all students in the class/section
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: diary.class_name,
      section: diary.section,
      academic_year: diary.academic_year,
      status: { $in: ['Verified', 'Approved', 'Published'] }
    });

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Create notifications for each student
    const notifications = students.map(student => ({
      recipient_email: student.parent_email || student.username,
      recipient_name: student.name,
      type: 'diary_published',
      title: `New Class Activity: ${diary.subject}`,
      message: `${diary.posted_by_name} posted a class activity "${diary.title}" for ${diary.subject}. Check the class diary for details.`,
      related_entity_id: diaryId,
      academic_year: diary.academic_year
    }));

    await base44.asServiceRole.entities.Notification.bulkCreate(notifications);

    return Response.json({ success: true, notified: students.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});