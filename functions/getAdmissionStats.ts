import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { academicYear } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    // Role-based filtering
    const userRole = user.role?.toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';
    
    let query = { academic_year: academicYear };

    // If staff, only show applications they can verify
    if (userRole === 'staff') {
      if (!user.permissions?.student_admission_permission) {
        return Response.json({ 
          success: true,
          pending: 0,
          verified: 0,
          approved: 0,
          converted: 0,
          rejected: 0,
          total: 0,
          message: 'No admission access'
        }, { status: 200 });
      }
    }

    // Fetch all applications for the year
    const applications = await base44.asServiceRole.entities.AdmissionApplication.filter(query);

    // Count by status
    const stats = {
      pending: 0,
      verified: 0,
      approved: 0,
      converted: 0,
      rejected: 0,
      total: applications.length
    };

    applications.forEach(app => {
      const status = app.status?.toLowerCase() || 'pending';
      if (stats.hasOwnProperty(status)) {
        stats[status]++;
      }
    });

    return Response.json({ 
      success: true,
      ...stats,
      academicYear: academicYear
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});