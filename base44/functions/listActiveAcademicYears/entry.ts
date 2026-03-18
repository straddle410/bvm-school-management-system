import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Returns only non-archived academic years, sorted by start_date desc.
// Use this instead of raw .list() everywhere in the UI.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const all = await base44.asServiceRole.entities.AcademicYear.list('-start_date');
    const active = all.filter(y => (y.status || 'Active').toLowerCase() !== 'archived');

    return Response.json({ success: true, years: active, count: active.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});