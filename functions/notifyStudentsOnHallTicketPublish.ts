import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process Published hall tickets
    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const hallTicket = data;
    const student_id = hallTicket.student_id;
    const academicYear = hallTicket.academic_year;

    if (!student_id || !academicYear) {
      return Response.json({ error: 'Missing student_id or academic_year' }, { status: 400 });
    }

    const contextId = `${hallTicket.id}_${student_id}`;

    // Deduplication check via Message entity
    const existing = await base44.asServiceRole.entities.Message.filter({
      context_type: 'hall_ticket_published',
      context_id: contextId,
    });
    if (existing.length > 0) {
      console.log('[notifyStudentsOnHallTicketPublish] Duplicate skipped for student:', student_id);
      return Response.json({ success: true, notified: 0, message: 'Duplicate prevented' });
    }

    const title = 'Hall Ticket Published';
    const body = `Your exam hall ticket for ${hallTicket.exam_type || 'Exam'} is now available. Download and print it.`;

    // Create Message entity (dedup record + in-app notification)
    await base44.asServiceRole.entities.Message.create({
      sender_id: 'system',
      sender_name: 'School',
      sender_role: 'admin',
      recipient_type: 'individual',
      recipient_id: student_id,
      recipient_name: hallTicket.student_name || student_id,
      subject: title,
      body,
      is_read: false,
      academic_year: academicYear,
      context_type: 'hall_ticket_published',
      context_id: contextId,
    });

    // Send push via centralized function
    try {
      await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
        student_ids: [student_id],
        title,
        message: body,
        url: '/StudentHallTicketView',
      });
    } catch (pushErr) {
      console.warn('[notifyStudentsOnHallTicketPublish] Push failed (non-fatal):', pushErr.message);
    }

    return Response.json({ success: true, notified: 1 });
  } catch (error) {
    console.error('[notifyStudentsOnHallTicketPublish] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});