import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { applicationId, academic_year } = body;

    if (!applicationId) {
      return Response.json({ error: 'applicationId is required' }, { status: 400 });
    }

    // Require academic_year in payload
    if (!academic_year || !academic_year.trim()) {
      return Response.json({ error: 'academic_year is required' }, { status: 400 });
    }

    // Verify academic_year exists and is not archived
    const allYears = await base44.asServiceRole.entities.AcademicYear.list();
    const matchedYear = allYears.find(y => y.year === academic_year);
    if (!matchedYear) {
      return Response.json({ error: `Academic year "${academic_year}" not found` }, { status: 422 });
    }
    if ((matchedYear.status || '').toLowerCase() === 'archived') {
      return Response.json({ error: `Academic year "${academic_year}" is archived and cannot be used for new conversions` }, { status: 422 });
    }

    // Role enforcement: Admin/Principal only
    const userRole = user.role?.toLowerCase();
    const isAuthorized = userRole === 'admin' || userRole === 'principal';

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden: Admin/Principal access required' }, { status: 403 });
    }

    // Step 1: Fetch application
    const application = await base44.asServiceRole.entities.AdmissionApplication.get(applicationId);
    
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Step 2: Validate status === Approved
    if (application.status !== 'Approved') {
      return Response.json({ 
        error: `Cannot convert: Application status is ${application.status}. Must be Approved.` 
      }, { status: 422 });
    }

    // Step 3: Validate no double conversion
    if (application.assigned_student_id) {
      return Response.json({ 
        error: 'Application already converted to student record' 
      }, { status: 409 });
    }

    // Step 4: Check section capacity
    const sectionConfig = await base44.asServiceRole.entities.SectionConfig.filter({
      class_name: application.applying_for_class,
      section: application.section,
      academic_year: application.academic_year,
      is_active: true
    });

    if (sectionConfig.length === 0) {
      return Response.json({ 
        error: `No capacity configuration found for ${application.applying_for_class}-${application.section} in ${application.academic_year}` 
      }, { status: 422 });
    }

    const config = sectionConfig[0];
    const currentStudentsInSection = await base44.asServiceRole.entities.Student.filter({
      class_name: application.applying_for_class,
      section: application.section,
      academic_year: application.academic_year,
      is_deleted: false
    });

    if (currentStudentsInSection.length >= config.capacity) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'CONVERSION_BLOCKED_CAPACITY',
        module: 'Admission',
        performed_by: user.email,
        timestamp: new Date().toISOString(),
        details: `Capacity limit reached for ${application.applying_for_class}-${application.section}. Current: ${currentStudentsInSection.length}, Capacity: ${config.capacity}`,
        academic_year: application.academic_year,
        class_name: application.applying_for_class,
        section: application.section
      });
      return Response.json({ 
        error: `Section capacity exceeded: ${currentStudentsInSection.length}/${config.capacity} students already enrolled` 
      }, { status: 422 });
    }

    // Step 5: Run duplicate checks
    const existingStudents = await base44.asServiceRole.entities.Student.filter({
      academic_year: application.academic_year
    });

    for (const student of existingStudents) {
      // Check by student_id
      if (student.student_id) {
        const duplicateById = await base44.asServiceRole.entities.Student.filter({
          student_id: student.student_id,
          academic_year: application.academic_year
        });
        if (duplicateById.length > 0) {
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'CONVERSION_BLOCKED_DUPLICATE',
            module: 'Admission',
            performed_by: user.email,
            timestamp: new Date().toISOString(),
            details: `Duplicate student_id detected: ${student.student_id}`,
            academic_year: application.academic_year
          });
          return Response.json({ 
            error: 'Duplicate: Student with this ID already exists' 
          }, { status: 422 });
        }
      }

      // Check by name (case-insensitive) + dob + academic_year
      if (student.name && student.dob) {
        if (student.name.toLowerCase() === application.student_name.toLowerCase() &&
            student.dob === application.dob &&
            student.academic_year === application.academic_year) {
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'CONVERSION_BLOCKED_DUPLICATE',
            module: 'Admission',
            performed_by: user.email,
            timestamp: new Date().toISOString(),
            details: `Duplicate name+dob: ${application.student_name} (${application.dob})`,
            academic_year: application.academic_year
          });
          return Response.json({ 
            error: 'Duplicate: Student with this name and DOB already exists' 
          }, { status: 422 });
        }
      }

      // Check by parent_phone + academic_year
      if (student.parent_phone && application.parent_phone) {
        if (student.parent_phone === application.parent_phone &&
            student.academic_year === application.academic_year) {
          await base44.asServiceRole.entities.AuditLog.create({
            action: 'CONVERSION_BLOCKED_DUPLICATE',
            module: 'Admission',
            performed_by: user.email,
            timestamp: new Date().toISOString(),
            details: `Duplicate parent phone: ${application.parent_phone}`,
            academic_year: application.academic_year
          });
          return Response.json({ 
            error: 'Duplicate: Student with this parent phone already exists in this academic year' 
          }, { status: 422 });
        }
      }
    }

    // Step 6: Generate student_id via secure function
    const studentIdResponse = await base44.asServiceRole.functions.invoke('generateStudentId', {
      academicYear: application.academic_year
    });
    const studentId = studentIdResponse.data?.student_id;

    if (!studentId) {
      return Response.json({ error: 'Failed to generate student ID' }, { status: 500 });
    }

    // Step 7: Generate roll_no via getNextRollNo
    const rollNoResponse = await base44.asServiceRole.functions.invoke('getNextRollNo', {
      className: application.applying_for_class,
      section: application.section,
      academicYear: application.academic_year
    });
    const rollNo = rollNoResponse.data?.rollNo;

    if (!rollNo) {
      return Response.json({ error: 'Failed to generate roll number' }, { status: 500 });
    }

    // Step 8: Create Student record using service role (capacity already verified)
    const newStudent = await base44.asServiceRole.entities.Student.create({
      student_id: studentId,
      name: application.student_name,
      dob: application.dob,
      gender: application.gender,
      class_name: application.applying_for_class,
      section: application.section,
      roll_no: rollNo,
      parent_name: application.parent_name,
      parent_phone: application.parent_phone,
      parent_email: application.parent_email,
      address: application.address,
      photo_url: application.photo_url,
      admission_date: new Date().toISOString().split('T')[0],
      academic_year: application.academic_year,
      status: 'Approved',
      approved_by: user.email
    });

    // Step 9: Update AdmissionApplication
    await base44.asServiceRole.entities.AdmissionApplication.update(applicationId, {
      status: 'Converted',
      assigned_student_id: newStudent.id,
      assigned_roll_no: rollNo
    });

    // Step 10: Create AuditLog entry
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'APPLICATION_CONVERTED',
      module: 'Admission',
      performed_by: user.email,
      timestamp: new Date().toISOString(),
      details: `Application ${application.application_no} converted to Student ${studentId} (Roll: ${rollNo})`,
      academic_year: application.academic_year
    });

    return Response.json({ 
      success: true, 
      message: 'Application converted to student record',
      studentId: studentId,
      rollNo: rollNo
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});