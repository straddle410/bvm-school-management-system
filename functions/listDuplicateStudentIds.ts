import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const allStudents = await base44.asServiceRole.entities.Student.list();
    
    // Group by student_id to find duplicates
    const grouped = {};
    allStudents.forEach(s => {
      const sid = String(s.student_id).trim();
      if (!grouped[sid]) grouped[sid] = [];
      grouped[sid].push({
        id: s.id,
        name: s.name,
        class_name: s.class_name,
        academic_year: s.academic_year,
        created_date: s.created_date,
        status: s.status
      });
    });

    const duplicates = Object.entries(grouped)
      .filter(([_, records]) => records.length > 1)
      .map(([student_id, records]) => ({
        student_id,
        count: records.length,
        records: records.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))
      }));

    return Response.json({
      total_student_ids: Object.keys(grouped).length,
      duplicate_count: duplicates.length,
      duplicates
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});