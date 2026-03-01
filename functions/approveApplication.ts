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

    // Role enforcement: Admin/Principal only
    const userRole = user.role?.toLowerCase();
    const isAuthorized = userRole === 'admin' || userRole === 'principal';

    if (!isAuthorized) {
      return Response.json({ error: 'Forbidden: Admin/Principal access required' }, { status: 403 });
    }

    // Fetch application
    const application = await base44.asServiceRole.entities.AdmissionApplication.get(applicationId);
    
    if (!application) {
      return Response.json({ error: 'Application not found' }, { status: 404 });
    }

    // Validate transition: only Verified → Approved allowed
    if (application.status !== 'Verified') {
      return Response.json({ 
        error: `Invalid transition: ${application.status} → Approved. Must be Verified first.` 
      }, { status: 422 });
    }

    // Update application to Approved
    await base44.asServiceRole.entities.AdmissionApplication.update(applicationId, {
      status: 'Approved',
      approved_by: user.email,
      approved_at: new Date().toISOString()
    });

    // Create audit log for approval
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'APPROVED',
      module: 'Admission',
      performed_by: user.email,
      timestamp: new Date().toISOString(),
      details: `Application ${application.application_no} approved`,
      academic_year: application.academic_year
    });

    // Atomically convert to Student (must succeed or entire approval fails)
    try {
      const conversionResponse = await base44.asServiceRole.functions.invoke('convertApplicationToStudent', {
        applicationId,
        academic_year: application.academic_year
      });

      if (!conversionResponse.data?.success) {
        // Rollback approval if conversion failed
        await base44.asServiceRole.entities.AdmissionApplication.update(applicationId, {
          status: 'Verified'
        });

        return Response.json({
          error: `Conversion failed: ${conversionResponse.data?.error || 'Unknown error'}. Approval reverted.`,
          conversion_error: conversionResponse.data?.error
        }, { status: 422 });
      }
    } catch (conversionError) {
      // Rollback approval if conversion threw error
      await base44.asServiceRole.entities.AdmissionApplication.update(applicationId, {
        status: 'Verified'
      });

      return Response.json({
        error: `Conversion failed: ${conversionError.message}. Approval reverted.`,
        conversion_error: conversionError.message
      }, { status: 422 });
    }

    // Send notification to verifying staff (if exists) - soft fail
    if (application.verified_by) {
      await base44.asServiceRole.functions.invoke('sendAdmissionNotification', {
        recipientEmails: [application.verified_by],
        application: { ...application, status: 'Approved' },
        action: 'APPROVED',
        performedBy: user.email
      }).catch(() => null);
    }

    return Response.json({ 
      success: true, 
      message: 'Application approved and converted to student',
      student_id: conversionResponse.data?.student_id,
      roll_no: conversionResponse.data?.roll_no
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});