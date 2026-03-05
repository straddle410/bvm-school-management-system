import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Verify current password
    let passwordValid = false;

    if (student.password_hash) {
      passwordValid = await comparePassword(current_password, student.password_hash);
    } else if (student.password) {
      passwordValid = current_password === student.password;
    }

    if (!passwordValid) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password
    const newPasswordHash = await hashPasswordBcrypt(new_password);

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

// Password hashing using SHA-256 with consistent salt
async function hashPasswordBcrypt(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'bvm_student_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

// Compare password with hash
async function comparePassword(password, hash) {
  const computedHash = await hashPasswordBcrypt(password);
  return computedHash === hash;
}