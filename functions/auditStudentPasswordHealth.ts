import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Canonical audit function for student password health
 * Replaces: migrateStudentPasswordsToBcrypt, convertSHA256ToBcrypt, fixStudentPasswordHashes
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const students = await base44.asServiceRole.entities.Student.list('', 10000);
    
    let bcrypt_hashes = 0;
    let legacy_sha256_hashes = 0;
    let plaintext_passwords = 0;
    let missing_password = 0;
    let must_change_flagged = 0;

    for (const student of students) {
      if (!student.password_hash && !student.password) {
        missing_password++;
        continue;
      }

      if (student.password_hash) {
        if (student.password_hash.startsWith('$2a$') || student.password_hash.startsWith('$2b$')) {
          bcrypt_hashes++;
        } else if (student.password_hash.length === 64 && /^[a-f0-9]{64}$/i.test(student.password_hash)) {
          legacy_sha256_hashes++;
        }
      }

      if (student.password) {
        plaintext_passwords++;
      }

      if (student.must_change_password) {
        must_change_flagged++;
      }
    }

    return Response.json({
      status: 'audit_complete',
      total_students: students.length,
      bcrypt_hashes,
      legacy_sha256_hashes,
      plaintext_passwords,
      missing_password,
      must_change_password_flagged: must_change_flagged,
      timestamp: new Date().toISOString(),
      security_status: legacy_sha256_hashes === 0 && plaintext_passwords === 0 ? 'SECURE' : 'NEEDS_MIGRATION',
      recommendation: legacy_sha256_hashes > 0 || plaintext_passwords > 0 ? 'Run convertSHA256ToBcrypt to migrate all students' : 'All passwords are secure bcrypt'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});