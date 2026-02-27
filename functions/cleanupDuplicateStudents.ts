import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role?.toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all students
    const allStudents = await base44.asServiceRole.entities.Student.list('', 10000);
    
    // Find duplicates by name + class + academic_year
    const grouped = {};
    allStudents.forEach(student => {
      const key = `${student.name}_${student.class_name}_${student.academic_year}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(student);
    });

    // Find duplicates
    const duplicates = [];
    for (const key in grouped) {
      if (grouped[key].length > 1) {
        duplicates.push({
          key,
          students: grouped[key]
        });
      }
    }

    if (duplicates.length === 0) {
      return Response.json({ message: 'No duplicate students found' });
    }

    // Delete the older duplicate (keep the most recent one)
    for (const group of duplicates) {
      const sorted = group.students.sort((a, b) => 
        new Date(b.created_date) - new Date(a.created_date)
      );
      // Delete all but the first (most recent)
      for (let i = 1; i < sorted.length; i++) {
        await base44.asServiceRole.entities.Student.delete(sorted[i].id);
      }
    }

    return Response.json({
      message: `Cleaned up ${duplicates.length} duplicate entries`,
      duplicates: duplicates.map(d => ({
        key: d.key,
        count: d.students.length,
        deleted: d.students.length - 1
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});