import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { student_id } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    // Fetch student
    const students = await base44.asServiceRole.entities.Student.filter({
      id: student_id
    });

    if (students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = students[0];
    const plainPassword = student.password || 'BVM123';

    // Hash password
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // Update student
    await base44.asServiceRole.entities.Student.update(student_id, {
      password_hash: passwordHash,
      password: null // Clear plaintext password
    });

    return Response.json({
      success: true,
      message: `Password hashed for student ${student.name}`,
      student_id: student.id,
      student_name: student.name
    });
  } catch (error) {
    console.error('hashStudentPassword error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});