import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin or Principal access required' }, { status: 403 });
    }

    const { action, student_id } = await req.json();

    if (!action || !student_id) {
      return Response.json({ error: 'action and student_id are required' }, { status: 400 });
    }

    if (!['delete', 'restore'].includes(action)) {
      return Response.json({ error: 'action must be "delete" or "restore"' }, { status: 400 });
    }

    // Fetch the student record
    const students = await base44.asServiceRole.entities.Student.filter({ id: student_id });
    const student = students[0];

    if (!student) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    if (action === 'delete') {
      // ── STEP 6: Check linked records ──
      const [attendance, marks, progressCards, hallTickets, homeworkSubmissions, quizAttempts] = await Promise.all([
        base44.asServiceRole.entities.Attendance.filter({ student_id: student.student_id }),
        base44.asServiceRole.entities.Marks.filter({ student_id: student.student_id }),
        base44.asServiceRole.entities.ProgressCard.filter({ student_id: student.id }),
        base44.asServiceRole.entities.HallTicket.filter({ student_id: student.id }),
        base44.asServiceRole.entities.HomeworkSubmission.filter({ student_id: student.student_id }),
        base44.asServiceRole.entities.QuizAttempt.filter({ student_id: student.student_id }),
      ]);

      const hasLinkedRecords =
        attendance.length > 0 ||
        marks.length > 0 ||
        progressCards.length > 0 ||
        hallTickets.length > 0 ||
        homeworkSubmissions.length > 0 ||
        quizAttempts.length > 0;

      if (hasLinkedRecords) {
        const details = [
          attendance.length > 0 ? `${attendance.length} attendance` : null,
          marks.length > 0 ? `${marks.length} marks` : null,
          progressCards.length > 0 ? `${progressCards.length} progress cards` : null,
          hallTickets.length > 0 ? `${hallTickets.length} hall tickets` : null,
          homeworkSubmissions.length > 0 ? `${homeworkSubmissions.length} homework submissions` : null,
          quizAttempts.length > 0 ? `${quizAttempts.length} quiz attempts` : null,
        ].filter(Boolean).join(', ');

        return Response.json({
          blocked: true,
          error: `Cannot delete student with academic records (${details}). Use Transfer or Passed Out status instead.`
        }, { status: 422 });
      }

      // Soft delete
      await base44.asServiceRole.entities.Student.update(student_id, { is_deleted: true });

      await base44.asServiceRole.entities.AuditLog.create({
        action: 'STUDENT_SOFT_DELETED',
        module: 'Student',
        performed_by: user.email,
        details: `${student.name} (${student.student_id}) soft-deleted from ${student.academic_year} by ${user.email}`,
        academic_year: student.academic_year,
        date: new Date().toISOString().split('T')[0],
      });

      return Response.json({ success: true, action: 'deleted', student_id });
    }

    if (action === 'restore') {
      await base44.asServiceRole.entities.Student.update(student_id, { is_deleted: false });

      await base44.asServiceRole.entities.AuditLog.create({
        action: 'STUDENT_RESTORED',
        module: 'Student',
        performed_by: user.email,
        details: `${student.name} (${student.student_id}) restored in ${student.academic_year} by ${user.email}`,
        academic_year: student.academic_year,
        date: new Date().toISOString().split('T')[0],
      });

      return Response.json({ success: true, action: 'restored', student_id });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});