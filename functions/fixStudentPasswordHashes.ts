import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const students = await base44.asServiceRole.entities.Student.list('', 10000);
    
    let fixed_count = 0;
    const defaultPassword = 'BVM123';

    for (const student of students) {
      // If student has password (plaintext from old migration) or invalid hash format
      // rehash with correct salt
      if (student.password || !student.password_hash || student.password_hash.startsWith('$2b$')) {
        const hash = await hashPasswordSHA256(defaultPassword);
        await base44.asServiceRole.entities.Student.update(student.id, {
          password_hash: hash,
          password: null,
          must_change_password: true
        });
        fixed_count++;
      }
    }

    return Response.json({
      status: 'completed',
      total_students: students.length,
      fixed_count,
      timestamp: new Date().toISOString(),
      note: 'All student passwords now hashed with consistent SHA-256 salt. Students must change password on next login.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Consistent SHA-256 hashing
async function hashPasswordSHA256(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'bvm_student_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}