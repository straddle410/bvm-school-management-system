import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user is admin
    if (user.role !== 'admin') {
      return Response.json({ error: 'Only admins can generate hall tickets' }, { status: 403 });
    }

    const { examTypeId, classname, section, academicYear, assignmentType } = await req.json();

    if (!examTypeId || !classname || !academicYear) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch students
    const query = { class_name: classname, academic_year: academicYear, status: 'Published' };
    if (section) query.section = section;
    
    const students = await base44.entities.Student.filter(query, '-roll_no');

    if (students.length === 0) {
      return Response.json({ error: 'No students found' }, { status: 404 });
    }

    // Generate hall ticket numbers
    const currentYear = new Date().getFullYear();
    const yy = String(currentYear).slice(-2);
    const cc = String(classname).padStart(2, '0');
    
    const hallTickets = [];

    students.forEach((student, idx) => {
      let xx;
      if (assignmentType === 'sequential') {
        xx = String(student.roll_no || idx + 1).padStart(2, '0');
      } else {
        // Random assignment
        xx = String(Math.floor(Math.random() * 100)).padStart(2, '0');
      }

      const hallTicketNumber = `${yy}${cc}${xx}`;

      hallTickets.push({
        hall_ticket_number: hallTicketNumber,
        exam_type: examTypeId,
        student_id: student.id,
        student_name: student.name,
        roll_number: student.roll_no,
        class_name: classname,
        section: section || 'A',
        student_photo_url: student.photo_url || '',
        academic_year: academicYear,
        status: 'Generated',
        generated_by: user.email
      });
    });

    // Bulk create hall tickets
    await base44.entities.HallTicket.bulkCreate(hallTickets);

    // Log the action
    await base44.entities.HallTicketLog.create({
      action: 'generated',
      hall_ticket_id: 'bulk',
      student_id: 'multiple',
      performed_by: user.email,
      details: `Generated ${hallTickets.length} hall tickets for Class ${classname}`
    });

    return Response.json({
      success: true,
      count: hallTickets.length,
      message: `Generated ${hallTickets.length} hall tickets successfully`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});