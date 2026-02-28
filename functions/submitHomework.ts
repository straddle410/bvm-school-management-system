import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { student_id, submission } = body;

    if (!student_id || !submission) {
      return Response.json({ error: 'student_id and submission are required' }, { status: 400 });
    }

    // ── SOFT-DELETE GUARD ──
    const students = await base44.asServiceRole.entities.Student.filter({ student_id });
    const student = students[0];
    if (student && student.is_deleted === true) {
      return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });
    }

    const result = await base44.asServiceRole.entities.HomeworkSubmission.create(submission);
    return Response.json({ success: true, id: result.id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});