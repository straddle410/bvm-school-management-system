import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role?.toLowerCase() !== 'admin' && user?.role?.toLowerCase() !== 'principal') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await req.json();
    const { student_id, event } = payload;

    if (event.type !== 'update') {
      return Response.json({ success: true });
    }

    // Fetch the student
    const student = await base44.entities.Student.filter({ id: student_id }, '-created_date', 1);
    if (!student || student.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentData = student[0];

    // If status changed to "Approved", create Admission record
    if (studentData.status === 'Approved') {
      // Check if Admission already exists
      const existing = await base44.entities.Admission.filter({
        student_name: studentData.name,
        academic_year: studentData.academic_year
      });

      if (existing.length === 0) {
        await base44.entities.Admission.create({
          application_no: `APP-${studentData.student_id}-${Date.now()}`,
          student_name: studentData.name,
          dob: studentData.dob,
          gender: studentData.gender,
          applying_for_class: studentData.class_name,
          section: studentData.section,
          photo_url: studentData.photo_url,
          parent_name: studentData.parent_name,
          parent_phone: studentData.parent_phone,
          parent_email: studentData.parent_email,
          address: studentData.address,
          status: 'Approved',
          academic_year: studentData.academic_year
        });
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});