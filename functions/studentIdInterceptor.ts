import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Student ID Uniqueness Interceptor
 * Validates student_id before create/update operations.
 * Blocks duplicates for {academic_year, student_id_norm}.
 * Auto-computes student_id_norm if not provided.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, student_id, academic_year, record_id } = await req.json();

    if (!action || !student_id || !academic_year) {
      return Response.json({
        error: 'Required: action, student_id, academic_year'
      }, { status: 400 });
    }

    const normalizedId = String(student_id).trim().toUpperCase();
    const allStudents = await base44.asServiceRole.entities.Student.list();

    // Ensure all students have student_id_norm computed
    const studentsWithNorm = allStudents.map(s => ({
      ...s,
      student_id_norm: s.student_id_norm || String(s.student_id).trim().toUpperCase()
    }));

    // Find conflicts in the same academic year
    const conflicts = studentsWithNorm.filter(s =>
      s.academic_year === academic_year &&
      !s.is_deleted &&
      s.student_id_norm === normalizedId
    );

    if (action === 'before_create') {
      if (conflicts.length > 0) {
        return Response.json({
          error: `Student ID "${student_id}" already exists in ${academic_year}`,
          conflict_records: conflicts.map(s => ({ id: s.id, name: s.name }))
        }, { status: 409 });
      }
      return Response.json({
        allowed: true,
        student_id_norm: normalizedId
      });
    }

    if (action === 'before_update') {
      // Allow if updating same record or no conflicts
      const otherConflicts = conflicts.filter(s => s.id !== record_id);
      if (otherConflicts.length > 0) {
        return Response.json({
          error: `Student ID "${student_id}" is already assigned to another student in ${academic_year}`,
          conflict_records: otherConflicts.map(s => ({ id: s.id, name: s.name }))
        }, { status: 409 });
      }
      return Response.json({
        allowed: true,
        student_id_norm: normalizedId
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});