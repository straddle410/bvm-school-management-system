import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { applicationId, rejectionReason, staffInfo } = await req.json();

    if (!applicationId) {
      return Response.json({ error: 'applicationId is required' }, { status: 400 });
    }

    const user = staffInfo || { email: 'system' };
    if (staffInfo) {
      const userRole = (staffInfo.role || '').toLowerCase();
      if (userRole !== 'admin' && userRole !== 'principal') {
        return Response.json({ error: 'Forbidden: Admin/Principal access required' }, { status: 403 });
      }
    }

    // Fetch application
    const application = await base44.asServiceRole.entities.AdmissionApplication.get(applicationId);
    
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Validate transition: Pending → Rejected or Verified → Rejected allowed
    if (application.status !== 'Pending' && application.status !== 'Verified') {
      return Response.json({ 
        error: `Invalid transition: ${application.status} → Rejected. Can only reject Pending or Verified applications.` 
      }, { status: 422 });
    }

    // Update application
    await base44.asServiceRole.entities.AdmissionApplication.update(applicationId, {
      status: 'Rejected',
      rejection_reason: rejectionReason || 'No reason provided',
      approved_by: user.email,
      approved_at: new Date().toISOString()
    });

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'REJECTED',
      module: 'Admission',
      performed_by: user.email,
      timestamp: new Date().toISOString(),
      details: `Application ${application.application_no} rejected. Reason: ${rejectionReason || 'No reason provided'}`,
      academic_year: application.academic_year
    });

    // Send notification to verifying staff (if exists)
    if (application.verified_by) {
      await base44.asServiceRole.functions.invoke('sendAdmissionNotification', {
        recipientEmails: [application.verified_by],
        application: { ...application, status: 'Rejected' },
        action: 'REJECTED',
        performedBy: user.email
      }).catch(() => null); // Soft fail if notification fails
    }

    return Response.json({ 
      success: true, 
      message: 'Application rejected' 
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});