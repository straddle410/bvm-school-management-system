import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { hall_ticket_number, academic_year } = await req.json();

    if (!hall_ticket_number || !academic_year) {
      return Response.json({ 
        valid: false, 
        error: 'hall_ticket_number and academic_year required' 
      }, { status: 400 });
    }

    // Fetch hall ticket
    const tickets = await base44.asServiceRole.entities.HallTicket.filter({
      hall_ticket_number,
      academic_year,
      status: 'Published'
    });

    if (tickets.length === 0) {
      return Response.json({
        valid: false,
        error: 'Hall ticket not found or not published',
        hall_ticket_number,
        academic_year
      });
    }

    const ticket = tickets[0];

    // Fetch student to verify
    const students = await base44.asServiceRole.entities.Student.filter({
      id: ticket.student_id
    });

    if (students.length === 0) {
      return Response.json({
        valid: false,
        error: 'Student record not found'
      });
    }

    const student = students[0];

    // Fetch exam type name
    const examTypes = await base44.asServiceRole.entities.ExamType.filter({
      id: ticket.exam_type
    });

    const examTypeName = examTypes.length > 0 ? examTypes[0].name : ticket.exam_type;

    // Return verification details
    return Response.json({
      valid: true,
      ticket: {
        hall_ticket_number: ticket.hall_ticket_number,
        student_name: ticket.student_name,
        student_id: student.student_id,
        class_name: ticket.class_name,
        section: ticket.section,
        roll_number: ticket.roll_number,
        exam_type: examTypeName,
        academic_year: ticket.academic_year,
        status: ticket.status,
        is_locked: ticket.is_locked
      },
      verified_at: new Date().toISOString(),
      verification_status: 'VALID'
    });
  } catch (error) {
    console.error('Error verifying hall ticket:', error);
    return Response.json({ 
      valid: false,
      error: error.message 
    }, { status: 500 });
  }
});