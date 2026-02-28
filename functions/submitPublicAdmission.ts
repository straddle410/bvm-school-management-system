import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    // Step 1: Extract and normalize input
    const {
      student_name,
      dob,
      gender,
      applying_for_class,
      section,
      photo_url,
      parent_name,
      parent_phone,
      parent_email,
      address,
      previous_school,
      documents
    } = payload;

    // Validate required fields
    const requiredFields = ['student_name', 'dob', 'gender', 'applying_for_class', 'parent_name', 'parent_phone', 'address'];
    for (const field of requiredFields) {
      if (!payload[field]) {
        return Response.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Normalize strings
    const normalizedStudentName = (student_name || '').trim();
    const normalizedParentName = (parent_name || '').trim();
    const normalizedParentPhone = (parent_phone || '').trim();
    const normalizedAddress = (address || '').trim();
    const normalizedParentEmail = (parent_email || '').trim();
    const normalizedPreviousSchool = (previous_school || '').trim();

    if (!normalizedStudentName) {
      return Response.json({ error: 'student_name cannot be empty' }, { status: 400 });
    }

    if (!normalizedParentPhone) {
      return Response.json({ error: 'parent_phone cannot be empty' }, { status: 400 });
    }

    // Step 2: Fetch active academic year (backend-controlled, NOT user input)
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({
      status: 'Active'
    });

    console.log('[submitPublicAdmission] Fetched AcademicYears:', JSON.stringify(academicYears));

    if (academicYears.length === 0) {
      return Response.json({
        error: 'No active academic year configured. Please contact school administration.'
      }, { status: 422 });
    }

    const activeYear = academicYears[0].year;
    console.log('[submitPublicAdmission] Active year selected:', activeYear);

    // Step 3: Duplicate check 1 - name + dob + year
    const duplicateByNameDob = await base44.asServiceRole.entities.AdmissionApplication.filter({
      academic_year: activeYear
    });

    for (const existingApp of duplicateByNameDob) {
      if (existingApp.student_name && existingApp.dob) {
        if (
          existingApp.student_name.toLowerCase() === normalizedStudentName.toLowerCase() &&
          existingApp.dob === dob
        ) {
          return Response.json({
            error: 'Duplicate application: A student with this name and date of birth already has an active application in this academic year.'
          }, { status: 422 });
        }
      }
    }

    // Step 4: Duplicate check 2 - parent phone + year
    for (const existingApp of duplicateByNameDob) {
      if (existingApp.parent_phone) {
        if (existingApp.parent_phone === normalizedParentPhone) {
          return Response.json({
            error: 'Duplicate application: An application with this parent phone number already exists in this academic year.'
          }, { status: 422 });
        }
      }
    }

    // Step 5: Generate application number
    const appNo = `APP-${Date.now().toString(36).toUpperCase()}`;

    // Step 6: Create AdmissionApplication with service role (backend enforces year)
    const newApplication = await base44.asServiceRole.entities.AdmissionApplication.create({
      application_no: appNo,
      student_name: normalizedStudentName,
      dob,
      gender,
      applying_for_class,
      section: section || 'A',
      photo_url,
      parent_name: normalizedParentName,
      parent_phone: normalizedParentPhone,
      parent_email: normalizedParentEmail,
      address: normalizedAddress,
      previous_school: normalizedPreviousSchool,
      documents: documents || [],
      status: 'Pending',
      academic_year: activeYear
    });

    // Step 7: Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'PUBLIC_SUBMISSION',
      module: 'Admission',
      performed_by: 'public-user',
      timestamp: new Date().toISOString(),
      details: `Public admission application submitted for ${normalizedStudentName} (${appNo})`,
      academic_year: activeYear
    });

    return Response.json({
      success: true,
      message: 'Application submitted successfully',
      application_id: newApplication.id,
      application_no: appNo,
      academic_year: activeYear
    }, { status: 201 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});