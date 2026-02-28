import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    // Only process on update to Approved status
    if (event.type !== 'update' || data.status !== 'Approved') {
      return Response.json({ success: true });
    }

    // Check if student already created
    if (data.assigned_student_id) {
      return Response.json({ success: true });
    }

    // Generate student_id and use it as username (login ID)
    const studentId = `S${Date.now().toString().slice(-5)}`; // e.g., S25001
    const defaultPassword = 'BVM123'; // Default password from spec

    // Auto-assign roll_no
    const classStudents = await base44.asServiceRole.entities.Student.filter({
      class_name: data.applying_for_class,
      section: data.section || 'A',
      academic_year: data.academic_year
    }, 'roll_no', 10000);
    const maxRoll = classStudents.reduce((max, s) => {
      const r = parseInt(s.roll_no);
      return !isNaN(r) && r > max ? r : max;
    }, 0);
    const rollNo = maxRoll + 1;

    // Create student record
    const newStudent = await base44.asServiceRole.entities.Student.create({
      name: data.student_name,
      student_id: studentId,
      username: studentId,
      password: defaultPassword,
      class_name: data.applying_for_class,
      section: data.section || 'A',
      roll_no: rollNo,
      photo_url: data.photo_url,
      parent_name: data.parent_name,
      parent_phone: data.parent_phone,
      parent_email: data.parent_email,
      dob: data.dob,
      gender: data.gender,
      address: data.address,
      admission_date: new Date().toISOString().split('T')[0],
      academic_year: data.academic_year,
      status: 'Active',
      approved_by: data.approved_by
    });

    // Update application with created student ID
    await base44.asServiceRole.entities.AdmissionApplication.update(data.id, {
      assigned_student_id: newStudent.id
    });

    // Send credentials to parent
    try {
      await base44.integrations.Core.SendEmail({
        to: data.parent_email,
        subject: 'Admission Approved - Login Credentials',
        body: `Dear ${data.parent_name},\n\nCongratulations! ${data.student_name}'s admission has been approved.\n\nLogin Credentials:\nUsername: ${studentId}\nPassword: ${defaultPassword}\n\nNote: Please change password on first login.\n\nBest regards,\nSchool Administration`
      });
    } catch {}

    return Response.json({ success: true, student_id: newStudent.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});