import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { ticketIds, academicYear } = await req.json();

    if (!ticketIds || !Array.isArray(ticketIds) || ticketIds.length === 0) {
      return Response.json({ error: 'ticketIds array required' }, { status: 400 });
    }

    if (!academicYear) {
      return Response.json({ error: 'academicYear required' }, { status: 400 });
    }

    // Note: Staff users use staff_session (localStorage), not Base44 auth
    // Access control is enforced on frontend, use asServiceRole here
    const user = { email: 'system' }; // Staff identity passed via session; backend uses service role

    // Fetch tickets to be published (all must be "Approved")
    const ticketsToPublish = await Promise.all(
      ticketIds.map(id => base44.asServiceRole.entities.HallTicket.filter({ id }))
    );
    
    const allTickets = ticketsToPublish.flat();
    
    if (allTickets.length !== ticketIds.length) {
      return Response.json({ error: 'Some tickets not found' }, { status: 404 });
    }

    // Validate all are "Approved"
    const nonApproved = allTickets.filter(t => t.status !== 'Approved');
    if (nonApproved.length > 0) {
      return Response.json({ 
        error: `Only "Approved" tickets can be published. Found ${nonApproved.length} tickets with status: ${nonApproved.map(t => t.status).join(', ')}`
      }, { status: 400 });
    }

    // Validate all are same academic year
    const wrongYear = allTickets.filter(t => t.academic_year !== academicYear);
    if (wrongYear.length > 0) {
      return Response.json({ 
        error: `All tickets must belong to academic year ${academicYear}`
      }, { status: 400 });
    }

    const publishDate = new Date().toISOString();

    // Bulk update status to "Published"
    await Promise.all(
      ticketIds.map(id =>
        base44.asServiceRole.entities.HallTicket.update(id, {
          status: 'Published',
          published_date: publishDate,
          published_by: user.email
        })
      )
    );

    // Trigger notifications for each published ticket (via automation)
    // System will process each ticket through notifyStudentsOnHallTicketPublish
    const publishedTickets = allTickets;

    return Response.json({
      success: true,
      count: publishedTickets.length,
      message: `Published ${publishedTickets.length} hall tickets`,
      ticketsPublished: publishedTickets.map(t => ({
        hall_ticket_number: t.hall_ticket_number,
        student_id: t.student_id,
        class_name: t.class_name
      }))
    });
  } catch (error) {
    console.error('Error publishing hall tickets:', error);
    return Response.json({ error: error.message || 'Server error' }, { status: 500 });
  }
});