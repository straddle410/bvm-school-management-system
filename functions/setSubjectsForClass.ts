import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { academic_year, class_name, subject_names } = await req.json();

    if (!academic_year || !class_name) {
      return Response.json({ error: 'academic_year and class_name are required' }, { status: 400 });
    }

    if (!Array.isArray(subject_names)) {
      return Response.json({ error: 'subject_names must be an array' }, { status: 400 });
    }

    // Validate academic_year is active (not archived)
    const years = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year });
    const yearRecord = years.find(y => (y.status || '').toLowerCase() !== 'archived');
    if (!yearRecord) {
      return Response.json({ error: `Academic year "${academic_year}" is not active or does not exist.` }, { status: 422 });
    }

    // Upsert: find existing config or create new
    const existing = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year,
      class_name
    });

    let result;
    if (existing.length > 0) {
      result = await base44.asServiceRole.entities.ClassSubjectConfig.update(existing[0].id, { subject_names });
    } else {
      result = await base44.asServiceRole.entities.ClassSubjectConfig.create({
        academic_year,
        class_name,
        subject_names
      });
    }

    return Response.json({ success: true, config: result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});