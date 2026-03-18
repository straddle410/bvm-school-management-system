import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { limit = 50, academicYear } = body;

    const filter = academicYear ? { academic_year: academicYear } : {};
    const backups = await base44.asServiceRole.entities.FullSchoolBackup.filter(filter, '-created_date', limit);

    return Response.json(backups || []);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});