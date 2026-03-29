import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin' && user.role !== 'principal') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { yearId } = await req.json();
    if (!yearId) {
      return Response.json({ error: 'yearId required' }, { status: 400 });
    }

    // Get all years
    const allYears = await base44.asServiceRole.entities.AcademicYear.list();
    
    // Update all years: set the target year to current, others to not current
    const updates = allYears.map(y => {
      const updates = { is_current: y.id === yearId };
      return base44.asServiceRole.entities.AcademicYear.update(y.id, updates);
    });

    await Promise.all(updates);

    return Response.json({ success: true, message: 'Academic year set as current' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});