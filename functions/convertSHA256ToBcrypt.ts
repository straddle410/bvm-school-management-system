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
    
    let converted_count = 0;
    const defaultPassword = 'BVM123';

    for (const student of students) {
      // Only convert SHA-256 hashes (64 char hex)
      if (student.password_hash && student.password_hash.length === 64 && /^[a-f0-9]{64}$/i.test(student.password_hash)) {
        // Create fresh bcrypt hash with default password
        const newHash = await bcrypt.hash(defaultPassword, 10);
        await base44.asServiceRole.entities.Student.update(student.id, {
          password_hash: newHash,
          must_change_password: true
        });
        converted_count++;
      }
    }

    return Response.json({
      status: 'completed',
      total_students: students.length,
      converted_from_sha256_to_bcrypt: converted_count,
      timestamp: new Date().toISOString(),
      note: 'All students now have bcrypt hashes. Default password reset to BVM123. All flagged for password change on next login.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});