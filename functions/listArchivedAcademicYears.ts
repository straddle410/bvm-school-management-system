import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Returns only archived academic years, sorted by start_date desc.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const all = await base44.asServiceRole.entities.AcademicYear.list('-start_date');
    const archived = all.filter(y => (y.status || '').toLowerCase() === 'archived');

    return Response.json({ success: true, years: archived, count: archived.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});