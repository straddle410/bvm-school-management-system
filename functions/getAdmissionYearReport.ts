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

    // Role-based access
    const userRole = user.role?.toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';
    
    if (userRole === 'staff' && !user.permissions?.student_admission_permission) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch all applications for the year (filtered)
    const allApplications = await base44.asServiceRole.entities.AdmissionApplication.filter({
      academic_year: academicYear
    });

    // Calculate base stats
    const stats = {
      total_applications: allApplications.length,
      total_verified: 0,
      total_approved: 0,
      total_converted: 0,
      total_rejected: 0,
      total_pending: 0
    };

    // Count by status
    allApplications.forEach(app => {
      const status = app.status;
      if (status === 'Verified') stats.total_verified++;
      else if (status === 'Approved') stats.total_approved++;
      else if (status === 'Converted') stats.total_converted++;
      else if (status === 'Rejected') stats.total_rejected++;
      else if (status === 'Pending') stats.total_pending++;
    });

    // Calculate rates
    const totalProcessed = stats.total_verified + stats.total_approved + stats.total_converted + stats.total_rejected;
    const stats_with_rates = {
      ...stats,
      verification_rate: totalProcessed > 0 ? ((stats.total_verified + stats.total_approved + stats.total_converted) / totalProcessed * 100).toFixed(2) : 0,
      approval_rate: stats.total_verified > 0 ? ((stats.total_approved + stats.total_converted) / stats.total_verified * 100).toFixed(2) : 0,
      conversion_rate: stats.total_approved > 0 ? (stats.total_converted / stats.total_approved * 100).toFixed(2) : 0,
      rejection_rate: totalProcessed > 0 ? (stats.total_rejected / totalProcessed * 100).toFixed(2) : 0
    };

    // Class-wise breakdown
    const classWise = {};
    allApplications.forEach(app => {
      const className = app.applying_for_class || 'Unknown';
      if (!classWise[className]) {
        classWise[className] = {
          class: className,
          total: 0,
          pending: 0,
          verified: 0,
          approved: 0,
          converted: 0,
          rejected: 0
        };
      }
      classWise[className].total++;
      if (app.status === 'Pending') classWise[className].pending++;
      else if (app.status === 'Verified') classWise[className].verified++;
      else if (app.status === 'Approved') classWise[className].approved++;
      else if (app.status === 'Converted') classWise[className].converted++;
      else if (app.status === 'Rejected') classWise[className].rejected++;
    });

    // Month-wise breakdown (created_date)
    const monthWise = {};
    allApplications.forEach(app => {
      const createdDate = new Date(app.created_date);
      const monthKey = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthWise[monthKey]) {
        monthWise[monthKey] = {
          month: monthKey,
          total: 0,
          pending: 0,
          verified: 0,
          approved: 0,
          converted: 0,
          rejected: 0
        };
      }
      monthWise[monthKey].total++;
      if (app.status === 'Pending') monthWise[monthKey].pending++;
      else if (app.status === 'Verified') monthWise[monthKey].verified++;
      else if (app.status === 'Approved') monthWise[monthKey].approved++;
      else if (app.status === 'Converted') monthWise[monthKey].converted++;
      else if (app.status === 'Rejected') monthWise[monthKey].rejected++;
    });

    // Sort month-wise by month
    const sortedMonthWise = Object.values(monthWise).sort((a, b) => a.month.localeCompare(b.month));

    return Response.json({
      success: true,
      academic_year: academicYear,
      summary: stats_with_rates,
      class_wise_breakdown: Object.values(classWise).sort((a, b) => {
        // Sort by class order (Nursery, LKG, UKG, 1-10)
        const classOrder = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
        return classOrder.indexOf(a.class) - classOrder.indexOf(b.class);
      }),
      month_wise_breakdown: sortedMonthWise,
      generated_at: new Date().toISOString()
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});