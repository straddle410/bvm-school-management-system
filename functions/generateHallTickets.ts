import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const { examTypeId, classname, section, academicYear, assignmentType, staffSession } = payload;

    if (!examTypeId || !classname || !academicYear) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Parse staff session
    let user;
    if (staffSession) {
      try {
        user = JSON.parse(staffSession);
      } catch {
        return Response.json({ error: 'Invalid session' }, { status: 401 });
      }
    }

    if (!user || (user.role !== 'Admin' && user.role !== 'admin' && user.role !== 'Principal' && user.role !== 'principal')) {
      return Response.json({ error: 'Only admins can generate hall tickets' }, { status: 403 });
    }

    // Create SDK with service role to bypass auth
    const base44 = createClientFromRequest(req);

    // Check if hall tickets already exist for this class/exam/year
    const existingTickets = await base44.asServiceRole.entities.HallTicket.filter({
      class_name: classname,
      exam_type: examTypeId,
      academic_year: academicYear,
      section: section || 'A'
    });

    if (existingTickets.length > 0) {
      return Response.json({
        error: `Hall tickets already exist for Class ${classname}-${section || 'A'} in this exam. Delete existing tickets first.`,
        existingCount: existingTickets.length
      }, { status: 409 });
    }

    // Fetch students
    const query = { class_name: classname, academic_year: academicYear, status: 'Published' };
    if (section) query.section = section;
    
    const students = await base44.asServiceRole.entities.Student.filter(query, '-roll_no');

    if (students.length === 0) {
      return Response.json({ error: 'No students found', count: 0 }, { status: 200 });
    }

    // Generate hall ticket numbers
    const currentYear = new Date().getFullYear();
    const yy = String(currentYear).slice(-2);
    const cc = String(classname).padStart(2, '0');
    
    const hallTickets = [];

    // Generate random sequence if needed
    let randomSequence = [];
    if (assignmentType === 'random') {
      // Create array [1, 2, 3, ..., studentCount]
      randomSequence = Array.from({ length: students.length }, (_, i) => i + 1);
      // Shuffle using Fisher-Yates
      for (let i = randomSequence.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [randomSequence[i], randomSequence[j]] = [randomSequence[j], randomSequence[i]];
      }
    }

    students.forEach((student, idx) => {
      let xx;
      if (assignmentType === 'sequential') {
        xx = String(student.roll_no || idx + 1).padStart(2, '0');
      } else {
        // Random assignment - use pre-generated unique sequence
        xx = String(randomSequence[idx]).padStart(2, '0');
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
        generated_by: user.email || user.full_name
      });
    });

    // Bulk create hall tickets
    await base44.asServiceRole.entities.HallTicket.bulkCreate(hallTickets);

    // Log the action
    await base44.asServiceRole.entities.HallTicketLog.create({
      action: 'generated',
      hall_ticket_id: 'bulk',
      student_id: 'multiple',
      performed_by: user.email || user.full_name,
      details: `Generated ${hallTickets.length} hall tickets for Class ${classname}`
    });

    return Response.json({
      success: true,
      count: hallTickets.length,
      message: `Generated ${hallTickets.length} hall tickets successfully`
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message || 'Server error' }, { status: 500 });
  }
});