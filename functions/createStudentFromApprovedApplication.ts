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

    // Require academic_year on the application record
    if (!data.academic_year || !data.academic_year.trim()) {
      return Response.json({ error: 'Application is missing academic_year — cannot create student' }, { status: 422 });
    }

    // Verify academic_year exists and is not archived
    const allYears = await base44.asServiceRole.entities.AcademicYear.list();
    const matchedYear = allYears.find(y => y.year === data.academic_year);
    if (!matchedYear) {
      return Response.json({ error: `Academic year "${data.academic_year}" not found` }, { status: 422 });
    }
    if ((matchedYear.status || '').toLowerCase() === 'archived') {
      return Response.json({ error: `Academic year "${data.academic_year}" is archived — student creation blocked` }, { status: 422 });
    }

    // Generate student_id using authoritative generator
    const genRes = await base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
      academic_year: data.academic_year
    });
    if (!genRes.data || !genRes.data.student_id) {
      return Response.json({ error: 'Failed to generate student ID' }, { status: 500 });
    }
    const studentId = genRes.data.student_id;
    const studentIdNorm = genRes.data.student_id_norm;
    
    // Hash default password using bcrypt
    const defaultPassword = 'BVM123';
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

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
      student_id_norm: studentIdNorm,
      username: studentId,
      password_hash: passwordHash,
      must_change_password: true,
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