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
      academic_year
    } = body;

    if (!academic_year) return Response.json({ error: 'academic_year is required' }, { status: 400 });

    const ARCHIVED_STATUSES = ['Passed Out', 'Transferred'];

    // Build filter object for indexed fields
    const filterObj = { academic_year };
    if (class_name && class_name !== 'all') filterObj.class_name = class_name;
    if (section && section !== 'all') filterObj.section = section;
    if (status && status !== 'all') filterObj.status = status;

    // Fetch filtered records (server-side by indexed fields)
    let allFiltered = await base44.asServiceRole.entities.Student.filter(filterObj, '-created_date', 10000);

    // Exclude archived if requested and no specific status filter
    if (exclude_archived && !status) {
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