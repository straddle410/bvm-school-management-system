import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { applicationId } = await req.json();

    if (!applicationId) {
      return Response.json({ error: 'applicationId is required' }, { status: 400 });
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

    // Fetch application
    const application = await base44.asServiceRole.entities.AdmissionApplication.get(applicationId);
    
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Validate transition: only Pending → Verified allowed
    if (application.status !== 'Pending') {
      return Response.json({ 
        error: `Invalid transition: ${application.status} → Verified` 
      }, { status: 422 });
    }

    // Update application
    await base44.asServiceRole.entities.AdmissionApplication.update(applicationId, {
      status: 'Verified',
      verified_by: user.email,
      verified_at: new Date().toISOString()
    });

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'VERIFIED',
      module: 'Admission',
      performed_by: user.email,
      timestamp: new Date().toISOString(),
      details: `Application ${application.application_no} verified`,
      academic_year: application.academic_year
    });

    return Response.json({ 
      success: true, 
      message: 'Application verified' 
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});