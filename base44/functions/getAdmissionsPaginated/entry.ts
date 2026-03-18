import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { academicYear, status, search, page = 1, limit = 20 } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    // Role-based access
    const userRole = user.role?.toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';
    const isTeacher = !isAdmin && (userRole === 'teacher' || userRole === 'staff');
    
    if (userRole === 'staff' && !user.permissions?.student_admission_permission) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Teacher year visibility enforcement - STRICT
    if (isTeacher) {
      // Fetch the requested year to validate teacher access
      const requestedYear = await base44.asServiceRole.entities.AcademicYear.filter({
        year: academicYear
      });

      if (requestedYear.length === 0) {
        return Response.json({ error: 'Academic year not found' }, { status: 404 });
      }

      const yearData = requestedYear[0];
      const isActive = yearData.status === 'Active';
      const isAdmissionOpen = yearData.admission_open === true;

      // Teachers can only access: Active year OR admission_open = true years
      if (!isActive && !isAdmissionOpen) {
        return Response.json({ 
          error: 'Access denied for selected academic year.' 
        }, { status: 403 });
      }
    }

    // Build query - ALWAYS filter by academic_year
    let query = { academic_year: academicYear };
    if (status) {
      query.status = status;
    }

    // Fetch all matching applications (no .list(), use filtered)
    const allApplications = await base44.asServiceRole.entities.AdmissionApplication.filter(query);

    // Apply search filter (client-side since searching multiple fields)
    let filtered = allApplications;
    if (search && search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = allApplications.filter(app =>
        app.student_name?.toLowerCase().includes(searchLower) ||
        app.application_no?.toLowerCase().includes(searchLower) ||
        app.parent_phone?.includes(search) ||
        app.parent_email?.toLowerCase().includes(searchLower)
      );
    }

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / limit);

    // Validate page
    const validPage = Math.max(1, Math.min(page, totalPages || 1));

    // Paginate
    const start = (validPage - 1) * limit;
    const paginatedResults = filtered.slice(start, start + limit);

    return Response.json({
      success: true,
      results: paginatedResults,
      total_count: totalCount,
      total_pages: totalPages,
      current_page: validPage,
      limit: limit,
      academic_year: academicYear,
      filters_applied: {
        status: status || null,
        search: search || null
      }
    }, { status: 200 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});