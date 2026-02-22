import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    // Fetch published hall tickets for this student
    const hallTickets = await base44.asServiceRole.entities.HallTicket.filter(
      { student_id, status: { $in: ['Published', 'Approved'] } },
      '-created_date'
    );

    // For each hall ticket, fetch its exam timetable
    const ticketsWithTimetable = await Promise.all(
      hallTickets.map(async (ticket) => {
        const timetable = await base44.asServiceRole.entities.ExamTimetable.filter(
          { exam_type: ticket.exam_type, academic_year: ticket.academic_year },
          'exam_date'
        );
        return { ...ticket, timetable };
      })
    );

    // Also fetch school profile
    const schoolProfiles = await base44.asServiceRole.entities.SchoolProfile.list();
    const schoolProfile = schoolProfiles[0] || null;

    return Response.json({ hallTickets: ticketsWithTimetable, schoolProfile });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});