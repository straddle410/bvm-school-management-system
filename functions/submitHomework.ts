import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    // ── CHECK EXISTING SUBMISSION ──
    const existingSubmissions = await base44.asServiceRole.entities.HomeworkSubmission.filter({
      homework_id: submission.homework_id,
      student_id: student_id
    });
    const existingSubmission = existingSubmissions[0];

    // ── RESUBMISSION LOGIC ──
    if (existingSubmission) {
      // Block resubmission if already graded
      if (existingSubmission.status === 'GRADED') {
        return Response.json({
          error: 'ALREADY_GRADED',
          message: 'Homework already graded. You cannot resubmit.'
        }, { status: 422 });
      }

      // Allow resubmission only if status is REVISION_REQUIRED or RESUBMITTED
      if (existingSubmission.status === 'REVISION_REQUIRED' || existingSubmission.status === 'RESUBMITTED') {
        // Update existing submission with new attempt
        const updatedData = {
          ...submission,
          attempt_no: (existingSubmission.attempt_no || 1) + 1,
          status: 'RESUBMITTED',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Preserve grading fields from previous attempt
          teacher_marks: existingSubmission.teacher_marks,
          teacher_feedback: existingSubmission.teacher_feedback,
          graded_at: existingSubmission.graded_at,
          graded_by: existingSubmission.graded_by
        };
        
        const result = await base44.asServiceRole.entities.HomeworkSubmission.update(existingSubmission.id, updatedData);
        return Response.json({ success: true, id: result.id, action: 'resubmitted' }, { status: 200 });
      }

      // If status is SUBMITTED, block duplicate submission
      return Response.json({
        error: 'ALREADY_SUBMITTED',
        message: 'You have already submitted this homework. Awaiting teacher review.'
      }, { status: 422 });
    }

    // ── NEW SUBMISSION ──
    const newSubmission = {
      ...submission,
      attempt_no: 1,
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const result = await base44.asServiceRole.entities.HomeworkSubmission.create(newSubmission);
    return Response.json({ success: true, id: result.id, action: 'submitted' }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});