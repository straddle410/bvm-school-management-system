import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { applicationId, updateData } = await req.json();

    if (!applicationId || !updateData) {
      return Response.json({ error: 'applicationId and updateData are required' }, { status: 400 });
    }

    // Role enforcement
    const userRole = user.role?.toLowerCase();
    const isAuthorized = 
      userRole === 'admin' || 
      userRole === 'principal' ||
      (userRole === 'staff' && user.permissions?.student_admission_permission === true);

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Fetch current application
    const application = await base44.asServiceRole.entities.AdmissionApplication.get(applicationId);
    
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Define locked fields per status
    const LOCKED_FIELDS = {
      'Pending': [],
      'Verified': ['student_name', 'dob', 'parent_phone', 'applying_for_class', 'academic_year', 'gender', 'section', 'previous_school', 'address'],
      'Approved': ['student_name', 'dob', 'parent_phone', 'applying_for_class', 'academic_year', 'gender', 'section', 'previous_school', 'address', 'remarks', 'internal_notes', 'assigned_roll_no'],
      'Converted': ['student_name', 'dob', 'parent_phone', 'applying_for_class', 'academic_year', 'gender', 'section', 'previous_school', 'address', 'remarks', 'internal_notes', 'assigned_roll_no'],
      'Rejected': ['student_name', 'dob', 'parent_phone', 'applying_for_class', 'academic_year', 'gender', 'section', 'previous_school', 'address', 'remarks', 'internal_notes', 'assigned_roll_no']
    };

    // Check if status allows edits
    const currentStatus = application.status;
    
    if (currentStatus === 'Approved' || currentStatus === 'Converted' || currentStatus === 'Rejected') {
      return Response.json({ 
        error: `Cannot edit application with status ${currentStatus}` 
      }, { status: 422 });
    }

    // Validate which fields can be edited
    const lockedFields = LOCKED_FIELDS[currentStatus] || [];
    const attemptedLockedFields = [];
    const validUpdates = {};
    const changedFields = [];

    for (const [field, value] of Object.entries(updateData)) {
      if (lockedFields.includes(field)) {
        attemptedLockedFields.push(field);
      } else {
        // Track field changes for audit
        if (application[field] !== value) {
          changedFields.push({
            field,
            old_value: application[field],
            new_value: value
          });
        }
        validUpdates[field] = value;
      }
    }

    // Return error if attempting to modify locked fields
    if (attemptedLockedFields.length > 0) {
      return Response.json({ 
        error: `Cannot edit locked fields in ${currentStatus} status: ${attemptedLockedFields.join(', ')}` 
      }, { status: 422 });
    }

    // If no valid updates, return 200 with no changes
    if (Object.keys(validUpdates).length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No updates applied' 
      }, { status: 200 });
    }

    // Apply updates via service role
    await base44.asServiceRole.entities.AdmissionApplication.update(applicationId, validUpdates);

    // Create audit log if fields changed
    if (changedFields.length > 0) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'APPLICATION_UPDATED',
        module: 'Admission',
        performed_by: user.email,
        timestamp: new Date().toISOString(),
        details: `Updated ${changedFields.length} field(s) for application ${application.application_no}`,
        academic_year: application.academic_year,
        changed_fields: changedFields
      });
    }

    return Response.json({ 
      success: true, 
      message: 'Application updated successfully',
      changedFieldsCount: changedFields.length
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});