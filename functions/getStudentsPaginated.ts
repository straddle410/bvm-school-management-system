import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const {
      page = 1,
      limit = 25,
      search = '',
      class_name = '',
      section = '',
      status = '',
      exclude_archived = false,
      show_deleted = false,
      academic_year
    } = body;

    if (!academic_year) return Response.json({ error: 'academic_year is required' }, { status: 400 });

    // Role-based access enforcement
    const userRole = user.role?.toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';
    const isTeacher = !isAdmin && (userRole === 'teacher' || userRole === 'staff');

    // Teachers must ONLY access the Active year for Student module
    if (isTeacher) {
      const yearData = await base44.asServiceRole.entities.AcademicYear.filter({
        year: academic_year
      });

      if (yearData.length === 0) {
        return Response.json({ error: 'Academic year not found' }, { status: 404 });
      }

      // Teacher can ONLY see students in Active year
      if (yearData[0].status !== 'Active') {
        return Response.json({ 
          error: 'Access denied: Teachers can only access the current active academic year.' 
        }, { status: 403 });
      }
    }

    const ARCHIVED_STATUSES = ['Passed Out', 'Transferred'];

    // Build filter object for indexed fields
    const filterObj = { academic_year };
    if (class_name && class_name !== 'all') filterObj.class_name = class_name;
    if (section && section !== 'all') filterObj.section = section;
    if (status && status !== 'all') filterObj.status = status;

    // Fetch filtered records (server-side by indexed fields)
    let allFiltered = await base44.asServiceRole.entities.Student.filter(filterObj, '-created_date', 10000);

    // ── Soft-delete filtering ──
    if (show_deleted) {
      // Admin only: show only deleted students
      allFiltered = allFiltered.filter(s => s.is_deleted === true);
    } else {
      // Default: exclude deleted students always
      allFiltered = allFiltered.filter(s => !s.is_deleted);
    }

    // Exclude archived if requested and no specific status filter
    if (!show_deleted && exclude_archived && !status) {
      allFiltered = allFiltered.filter(s => !ARCHIVED_STATUSES.includes(s.status));
    }

    // Apply search (case-insensitive) on name, student_id, parent_name
    let results = allFiltered;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      results = allFiltered.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.student_id?.toLowerCase().includes(q) ||
        s.parent_name?.toLowerCase().includes(q)
      );
    }

    const total_count = results.length;
    const total_pages = Math.max(1, Math.ceil(total_count / limit));
    const current_page = Math.min(page, total_pages);
    const offset = (current_page - 1) * limit;
    const data = results.slice(offset, offset + limit);

    return Response.json({ data, total_count, total_pages, current_page });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});