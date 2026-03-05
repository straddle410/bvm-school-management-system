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
    let plaintext_count = 0;

    for (const student of students) {
      if (!student.password_hash && !student.password) continue;

      // Check format
      if (student.password_hash) {
        if (student.password_hash.startsWith('$2b$')) {
          bcrypt_count++;
        } else if (student.password_hash.length === 64 && /^[a-f0-9]{64}$/i.test(student.password_hash)) {
          sha256_count++;
        }
      } else if (student.password) {
        plaintext_count++;
      }
    }

    return Response.json({
      status: 'audit_complete',
      total_students: students.length,
      bcrypt_hashes: bcrypt_count,
      legacy_sha256_hashes: sha256_count,
      plaintext_passwords: plaintext_count,
      timestamp: new Date().toISOString(),
      recommendation: sha256_count > 0 || plaintext_count > 0 ? 'Run migrateStudentPasswordsToBcrypt to fix' : 'All hashes are secure bcrypt'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});