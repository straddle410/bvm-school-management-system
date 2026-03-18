import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const students = await base44.asServiceRole.entities.Student.list('', 10000);
    
    let bcrypt_count = 0;
    let sha256_count = 0;
    let migrated_count = 0;
    const migrationErrors = [];

    for (const student of students) {
      if (!student.password_hash) continue;

      // Check if already bcrypt (starts with $2b$)
      if (student.password_hash.startsWith('$2b$')) {
        bcrypt_count++;
        continue;
      }

      // Detect SHA-256 format (64 char hex string)
      if (student.password_hash.length === 64 && /^[a-f0-9]{64}$/i.test(student.password_hash)) {
        sha256_count++;
        // Force password reset on next login instead of trying to recover
        try {
          await base44.asServiceRole.entities.Student.update(student.id, {
            must_change_password: true
          });
          migrated_count++;
        } catch (err) {
          migrationErrors.push({
            student_id: student.student_id,
            error: err.message
          });
        }
      }
    }

    return Response.json({
      status: 'completed',
      total_students: students.length,
      bcrypt_hashes: bcrypt_count,
      legacy_sha256_hashes: sha256_count,
      forced_password_reset: migrated_count,
      migration_errors: migrationErrors,
      timestamp: new Date().toISOString(),
      note: 'Legacy SHA-256 hashes identified. Students flagged for password reset on next login. New passwords will use bcrypt.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});