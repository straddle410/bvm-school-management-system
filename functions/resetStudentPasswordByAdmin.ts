import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(user.role || '').trim().toLowerCase();
    if (role !== 'admin' && role !== 'principal') {
      return Response.json({ error: 'Forbidden: admin only' }, { status: 403 });
    }

    const { student_id } = await req.json();
    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    // Fetch student
    const students = await base44.asServiceRole.entities.Student.filter({ student_id: student_id.trim() }, null, 1);
    if (!students || students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = students[0];
    const tempPassword = Math.random().toString(36).slice(2, 8).toUpperCase();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    // Update student password
    await base44.asServiceRole.entities.Student.update(student.id, {
      password_hash: hashedPassword,
      password: null,
      must_change_password: true
    });

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'STUDENT_PASSWORD_RESET',
      module: 'Student',
      performed_by: user.email,
      student_id: student.student_id,
      details: JSON.stringify({
        student_name: student.name,
        reset_by: user.email,
        temporary_password: tempPassword,
        timestamp: new Date().toISOString()
      }),
      timestamp: new Date().toISOString()
    });

    return Response.json({
      success: true,
      message: `Password reset for ${student.name}`,
      student_id: student.student_id,
      student_name: student.name,
      temporary_password: tempPassword,
      instruction: 'Share this temporary password with the student. They must change it on first login.'
    });
  } catch (error) {
    console.error('[resetStudentPasswordByAdmin] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});