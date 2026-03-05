import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const allStaff = await base44.asServiceRole.entities.StaffAccount.list('', 10000);
    
    let bcrypt_real = 0;
    let legacy_fake = 0;
    let missing_password = 0;
    let force_change_flagged = 0;

    for (const staff of allStaff) {
      if (!staff.password_hash) {
        missing_password++;
        continue;
      }

      if (staff.password_hash.startsWith('$2a$') || staff.password_hash.startsWith('$2b$')) {
        bcrypt_real++;
      } else if (staff.password_hash.startsWith('$2b$10$')) {
        legacy_fake++;
      }

      if (staff.force_password_change) {
        force_change_flagged++;
      }
    }

    return Response.json({
      status: 'audit_complete',
      total_staff: allStaff.length,
      bcrypt_real_hashes: bcrypt_real,
      legacy_fake_bcrypt_hashes: legacy_fake,
      missing_password_hash: missing_password,
      force_password_change_flagged: force_change_flagged,
      timestamp: new Date().toISOString(),
      recommendation: legacy_fake > 0 ? 'Run migrateStaffPasswordsToBcrypt to complete migration' : 'All passwords are secure bcrypt'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});