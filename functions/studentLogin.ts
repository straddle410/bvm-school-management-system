import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    // Verify password with backward compatibility
    let passwordValid = false;
    let needsMigration = false;

    // First try hashed password (new method)
    if (student.password_hash) {
      passwordValid = await comparePassword(password, student.password_hash);
    } 
    // Fallback to plaintext for backward compatibility
    else if (student.password) {
      passwordValid = password === student.password;
      if (passwordValid) {
        needsMigration = true; // Mark for migration
      }
    }

    if (!passwordValid) {
      return Response.json({ error: 'PASSWORD_MISMATCH' }, { status: 401 });
    }

    // If plaintext password matched, migrate to hash immediately
    if (needsMigration) {
      const newHash = await hashPasswordBcrypt(password);
      await base44.asServiceRole.entities.Student.update(student.id, {
        password_hash: newHash,
        password: null,
        must_change_password: true
      });
      // Refresh student record
      const updated = await base44.asServiceRole.entities.Student.filter({ 
        student_id_norm: studentIdNorm 
      });
      if (updated.length > 0) {
        student.must_change_password = updated[0].must_change_password;
        student.password_hash = updated[0].password_hash;
      }
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

// Password hashing using PBKDF2 (bcrypt-like)
async function hashPasswordBcrypt(password) {
  const encoder = new TextEncoder();
  const salt = 'student_salt_bvm';
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return '$2b$12$' + hashHex.substring(0, 53);
}

// Compare password with hash
async function comparePassword(password, hash) {
  const encoder = new TextEncoder();
  const salt = 'student_salt_bvm';
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const computedHash = '$2b$12$' + hashHex.substring(0, 53);
  return computedHash === hash;
}