import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Admin-only endpoint to reassign student_id (bypasses RLS).
 * Validates against interceptor rules before applying.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { record_id, new_student_id } = await req.json();

    if (!record_id || !new_student_id) {
      return Response.json({
        error: 'Required: record_id, new_student_id'
      }, { status: 400 });
    }

    // Fetch the target record to get academic_year
    const allStudents = await base44.asServiceRole.entities.Student.list();
    const targetRecord = allStudents.find(s => s.id === record_id);

    if (!targetRecord) {
      return Response.json({
        error: 'Student record not found'
      }, { status: 404 });
    }

    const normalizedId = String(new_student_id).trim().toUpperCase();
    const academic_year = targetRecord.academic_year;

    // Validate uniqueness: check no other student has same normalized ID in this year
    const conflicts = allStudents.filter(s =>
      s.id !== record_id &&
      s.academic_year === academic_year &&
      !s.is_deleted &&
      String(s.student_id).trim().toUpperCase() === normalizedId
    );

    if (conflicts.length > 0) {
      return Response.json({
        error: `Student ID "${new_student_id}" already assigned in ${academic_year}`,
        conflicts: conflicts.map(s => ({ id: s.id, name: s.name }))
      }, { status: 409 });
    }

    // Update record with admin privileges (bypasses RLS)
    await base44.asServiceRole.entities.Student.update(record_id, {
      student_id: new_student_id,
      student_id_norm: normalizedId,
      username: new_student_id
    });

    return Response.json({
      success: true,
      record_id,
      previous_id: targetRecord.student_id,
      new_student_id,
      student_id_norm: normalizedId,
      name: targetRecord.name,
      academic_year
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});