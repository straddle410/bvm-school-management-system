import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { student_id, current_password, new_password } = payload;

    if (!student_id || !current_password || !new_password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Fetch student
    const students = await base44.asServiceRole.entities.Student.filter({
      id: student_id
    });

    if (students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = students[0];

    // Reject default password
    if (new_password === 'BVM123') {
      return Response.json({ error: 'DEFAULT_PASSWORD_NOT_ALLOWED' }, { status: 400 });
    }

    // Cannot reuse student ID as password
    if (new_password === student.student_id || new_password === student.username) {
      return Response.json({ error: 'PASSWORD_CANNOT_BE_STUDENT_ID' }, { status: 400 });
    }

    // Verify current password
    let passwordValid = false;

    if (student.password_hash) {
      passwordValid = await bcrypt.compare(current_password, student.password_hash);
    } else if (student.password) {
      passwordValid = current_password === student.password;
    }

    if (!passwordValid) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password with bcrypt
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update student record
    await base44.asServiceRole.entities.Student.update(student_id, {
      password_hash: newPasswordHash,
      password: null,
      must_change_password: false
    });

    return Response.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});