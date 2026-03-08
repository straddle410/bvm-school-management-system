import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function verifyStaffToken(token) {
  try {
    const secret = Deno.env.get('STAFF_SESSION_SECRET');
    if (!secret || !token) return null;
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 0) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    let exp = payload.exp;
    if (exp > 1e12) exp = Math.floor(exp / 1000);
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, student_id, staff_session_token } = body;

    // Auth: staff session token first, fall back to base44.auth.me()
    let userRole = null;
    let performedBy = 'unknown';

    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (payload) {
        userRole = (payload.role || '').toLowerCase();
        performedBy = payload.email || payload.username || 'staff';
      }
    }

    if (!userRole) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      userRole = (user.role || '').toLowerCase();
      performedBy = user.email || 'unknown';
    }

    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Forbidden: Admin or Principal access required' }, { status: 403 });
    }

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
        performed_by: performedBy,
        details: `${student.name} (${student.student_id}) soft-deleted from ${student.academic_year} by ${performedBy}`,
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
        performed_by: performedBy,
        details: `${student.name} (${student.student_id}) restored in ${student.academic_year} by ${performedBy}`,
        academic_year: student.academic_year,
        date: new Date().toISOString().split('T')[0],
      });

      return Response.json({ success: true, action: 'restored', student_id });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});