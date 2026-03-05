import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { student_id_input, password } = payload;

    if (!student_id_input || !password) {
      return Response.json({ error: 'INVALID_CREDENTIALS' }, { status: 400 });
    }

    // Normalize input: trim and lowercase (for case-insensitive matching)
    const studentIdNorm = student_id_input.trim().toLowerCase();

    // Look up student by normalized student_id_norm
    const students = await base44.asServiceRole.entities.Student.filter({
      student_id_norm: studentIdNorm
    });

    if (students.length === 0) {
      return Response.json({ error: 'STUDENT_NOT_FOUND' }, { status: 401 });
    }

    const student = students[0];

    // Check if student is active
    if (student.is_deleted || (student.is_active === false)) {
      return Response.json({ error: 'ACCOUNT_INACTIVE' }, { status: 401 });
    }

    // Verify password
    let passwordValid = false;
    if (student.password_hash) {
      passwordValid = await bcrypt.compare(password, student.password_hash);
    } else if (student.password) {
      // Fallback for very old plaintext passwords
      passwordValid = password === student.password;
    }

    if (!passwordValid) {
      return Response.json({ error: 'PASSWORD_MISMATCH' }, { status: 401 });
    }

    // Successful login
    return Response.json({
      success: true,
      student_id: student.id,
      student_id_display: student.student_id,
      name: student.name,
      class_name: student.class_name,
      section: student.section,
      roll_no: student.roll_no,
      photo_url: student.photo_url,
      academic_year: student.academic_year,
      parent_name: student.parent_name,
      parent_phone: student.parent_phone,
      must_change_password: student.must_change_password || false
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});