import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all students without student_id
    const studentsWithoutId = await base44.asServiceRole.entities.Student.filter({ student_id: null }, '', 1000);
    
    if (studentsWithoutId.length === 0) {
      return Response.json({ message: 'No students without IDs', processed: 0 });
    }

    const results = [];

    for (const student of studentsWithoutId) {
      try {
        if (!student.academic_year) {
          results.push({ studentId: student.id, name: student.name, status: 'SKIPPED', reason: 'No academic_year set' });
          continue;
        }

        // Generate student ID for this year
        const genRes = await base44.functions.invoke('generateStudentIdAuthoritative', {
          academic_year: student.academic_year
        });

        const { student_id, student_id_norm } = genRes.data;

        // Update student with generated ID and username
        await base44.asServiceRole.entities.Student.update(student.id, {
          student_id,
          student_id_norm,
          username: student.username || student_id,
          must_change_password: true
        });

        results.push({
          studentId: student.id,
          name: student.name,
          class: student.class_name,
          section: student.section,
          assignedId: student_id,
          status: 'SUCCESS'
        });
      } catch (e) {
        results.push({
          studentId: student.id,
          name: student.name,
          status: 'ERROR',
          reason: e.message
        });
      }
    }

    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'ERROR').length;

    return Response.json({
      message: `Processed ${results.length} students`,
      successful,
      failed,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});