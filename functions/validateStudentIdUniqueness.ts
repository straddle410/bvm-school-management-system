import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Validation guard: reject create/update if {school_id, academic_year, student_id_norm} already exists.
 * Normalize: trim + uppercase for case-insensitive matching.
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
        error: 'Required: action (validate/before_create/before_update), student_id, academic_year' 
      }, { status: 400 });
    }

    const normalizedId = String(student_id).trim().toUpperCase();
    const allStudents = await base44.asServiceRole.entities.Student.list();

    // Find all students in the same academic year with same normalized student_id
    const duplicates = allStudents.filter(s => 
      s.academic_year === academic_year &&
      !s.is_deleted &&
      String(s.student_id).trim().toUpperCase() === normalizedId
    );

    if (action === 'validate') {
      // Pure check without restrictions
      return Response.json({
        academic_year,
        student_id: normalizedId,
        exists: duplicates.length > 0,
        count: duplicates.length,
        records: duplicates.map(s => ({ id: s.id, name: s.name }))
      });
    }

    if (action === 'before_create') {
      // Reject if already exists
      if (duplicates.length > 0) {
        return Response.json({
          error: `Student ID "${student_id}" already exists in academic year ${academic_year}`,
          existing_records: duplicates.map(s => ({ id: s.id, name: s.name }))
        }, { status: 409 });
      }
      return Response.json({ allowed: true });
    }

    if (action === 'before_update') {
      // Reject if another record (not this one) already has this ID
      if (record_id) {
        const otherDuplicates = duplicates.filter(s => s.id !== record_id);
        if (otherDuplicates.length > 0) {
          return Response.json({
            error: `Student ID "${student_id}" is already assigned to another student in ${academic_year}`,
            conflict_records: otherDuplicates.map(s => ({ id: s.id, name: s.name }))
          }, { status: 409 });
        }
      }
      return Response.json({ allowed: true });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});