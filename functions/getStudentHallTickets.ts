import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    // Use service role to fetch hall tickets
    const hallTickets = await base44.asServiceRole.entities.HallTicket.filter(
      { student_id, status: 'Published' },
      '-created_date'
    );

    return Response.json({ hallTickets });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});