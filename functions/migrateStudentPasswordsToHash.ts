import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const students = await base44.asServiceRole.entities.Student.list('', 10000);
    
    let migrated_count = 0;
    let already_hashed_count = 0;
    let missing_both_count = 0;

    for (const student of students) {
      // Already has hashed password
      if (student.password_hash) {
        already_hashed_count++;
        continue;
      }

      // Has plaintext password - migrate it
      if (student.password) {
        const hash = await hashPasswordBcrypt(student.password);
        await base44.asServiceRole.entities.Student.update(student.id, {
          password_hash: hash,
          password: null,
          must_change_password: true
        });
        migrated_count++;
      } else {
        // Neither hash nor plaintext - cannot migrate
        missing_both_count++;
      }
    }

    return Response.json({
      status: 'completed',
      total_students: students.length,
      migrated_count,
      already_hashed_count,
      missing_both_count,
      timestamp: new Date().toISOString(),
      note: 'All passwords now stored as hashes. Students with migrated passwords must change password on next login.'
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