import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { academicYear, status, page = 1, limit = 20 } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    // Role-based access
    const userRole = user.role?.toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';
    
    if (userRole === 'staff' && !user.permissions?.student_admission_permission) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Build query
    let query = { academic_year: academicYear };
    if (status) {
      query.status = status;
    }

    // Fetch applications
    const applications = await base44.asServiceRole.entities.AdmissionApplication.filter(query);

    // Calculate SLA data
    const SLA_THRESHOLDS = {
      'Pending': 3,
      'Verified': 2
    };

    const enrichedApps = applications.map(app => {
      let daysInStatus = 0;
      let statusTimestamp = app.created_date;

      // Determine which timestamp to use
      if (app.status === 'Verified' && app.verified_at) {
        statusTimestamp = app.verified_at;
      } else if (app.status === 'Approved' && app.approved_at) {
        statusTimestamp = app.approved_at;
      }

      // Calculate days
      const now = new Date();
      const updated = new Date(statusTimestamp);
      const diffMs = now - updated;
      daysInStatus = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      // Check SLA breach
      const threshold = SLA_THRESHOLDS[app.status];
      const slaBreached = threshold ? daysInStatus > threshold : false;

      return {
        ...app,
        days_in_status: daysInStatus,
        sla_breached: slaBreached,
        sla_threshold: threshold
      };
    });

    // Sort by SLA breach first, then days in status descending
    enrichedApps.sort((a, b) => {
      if (a.sla_breached !== b.sla_breached) {
        return b.sla_breached ? 1 : -1;
      }
      return b.days_in_status - a.days_in_status;
    });

    // Paginate
    const start = (page - 1) * limit;
    const paginated = enrichedApps.slice(start, start + limit);

    return Response.json({
      success: true,
      applications: paginated,
      total: enrichedApps.length,
      page: page,
      limit: limit,
      pages: Math.ceil(enrichedApps.length / limit)
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});