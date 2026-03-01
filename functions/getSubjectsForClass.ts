import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { academic_year, class_name } = await req.json();

    if (!academic_year || !class_name) {
      return Response.json({ error: 'academic_year and class_name are required' }, { status: 400 });
    }

    // Look up ClassSubjectConfig for this year+class
    const configs = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year,
      class_name
    });

    if (configs.length > 0 && configs[0].subject_names?.length > 0) {
      // Return subjects from scoped config
      return Response.json({ subjects: configs[0].subject_names, source: 'config' });
    }

    // Fallback: return all global subjects (sorted by sort_order)
    const allSubjects = await base44.asServiceRole.entities.Subject.list();
    const sorted = allSubjects.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    return Response.json({ subjects: sorted.map(s => s.name), source: 'global_fallback' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});