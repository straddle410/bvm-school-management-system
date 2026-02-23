import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event?.type !== 'update' || data?.status !== 'Published') {
      return Response.json({ success: false, message: 'Not a publish event' });
    }

    const marks = data;
    if (!marks.id || !marks.student_id) {
      return Response.json({ success: false, message: 'Missing student or marks ID' });
    }

    const notification = {
      recipient_student_id: marks.student_id,
      recipient_name: marks.student_name,
      type: 'results_posted',
      title: `Results Published - ${marks.subject}`,
      message: `Your results for ${marks.subject} (${marks.exam_type}) have been published`,
      related_entity_id: marks.id,
      is_read: false,
      academic_year: marks.academic_year
    };

    await base44.asServiceRole.entities.Notification.create(notification);

    return Response.json({ success: true, created: 1 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});