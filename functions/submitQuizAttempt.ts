import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { student_id, attempt } = body;

    if (!student_id || !attempt) {
      return Response.json({ error: 'student_id and attempt are required' }, { status: 400 });
    }

    // ── SOFT-DELETE GUARD ──
    // student_id here is the Student entity student_id field (e.g. S0001),
    // but for student portal the student_id passed may be the entity ID.
    // Try both: first by student_id field, then by entity id.
    let student = null;
    const byStudentId = await base44.asServiceRole.entities.Student.filter({ student_id });
    if (byStudentId.length > 0) {
      student = byStudentId[0];
    } else {
      // Fallback: try as entity ID
      const byId = await base44.asServiceRole.entities.Student.filter({ id: student_id });
      if (byId.length > 0) student = byId[0];
    }

    if (student && student.is_deleted === true) {
      return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });
    }

    const result = await base44.asServiceRole.entities.QuizAttempt.create(attempt);
    return Response.json({ success: true, id: result.id, ...result }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});