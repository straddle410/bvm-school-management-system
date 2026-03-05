import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { student_id, submission } = body;

    if (!student_id || !submission) {
      return Response.json({ error: 'student_id and submission are required' }, { status: 400 });
    }

    // ── STUDENT VALIDATION ──
    const students = await base44.asServiceRole.entities.Student.filter({ student_id });
    const student = students[0];
    if (!student) {
      return Response.json({ error: 'Student not found.' }, { status: 404 });
    }
    if (student.is_deleted === true) {
      return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });
    }

    // ── HOMEWORK SUBMISSION MODE CHECK ──
    const homeworks = await base44.asServiceRole.entities.Homework.filter({ id: submission.homework_id });
    const homework = homeworks[0];
    if (!homework) {
      return Response.json({ error: 'Homework not found.' }, { status: 404 });
    }
    if (homework.submission_mode === 'VIEW_ONLY') {
      return Response.json({ error: 'HOMEWORK_NOT_ACCEPTING_SUBMISSIONS', message: 'This homework is view-only.' }, { status: 422 });
    }

    const result = await base44.asServiceRole.entities.HomeworkSubmission.create(submission);
    return Response.json({ success: true, id: result.id }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});