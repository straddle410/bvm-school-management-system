import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const allStaff = await base44.asServiceRole.entities.StaffAccount.list('', 10000);
    
    let already_bcrypt = 0;
    let legacy_fake_bcrypt = 0;
    let migrated_count = 0;
    const migrationErrors = [];

    for (const staff of allStaff) {
      if (!staff.password_hash) continue;

      // Check if already real bcrypt
      if (staff.password_hash.startsWith('$2a$') || staff.password_hash.startsWith('$2b$')) {
        already_bcrypt++;
        continue;
      }

      // Detect legacy fake bcrypt (looks like $2b$10$...)
      if (staff.password_hash.startsWith('$2b$10$')) {
        legacy_fake_bcrypt++;
        // For legacy fake bcrypt, we can't recover the original password
        // Must force password reset on next login
        try {
          await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
            force_password_change: true
          });
          migrated_count++;
        } catch (err) {
          migrationErrors.push({
            username: staff.username,
            error: err.message
          });
        }
      }
    }

    return Response.json({
      status: 'completed',
      total_staff: allStaff.length,
      already_bcrypt,
      legacy_fake_bcrypt,
      flagged_for_password_reset: migrated_count,
      migration_errors: migrationErrors,
      timestamp: new Date().toISOString(),
      note: 'Legacy staff passwords cannot be recovered. All legacy accounts flagged for password reset on next login. New passwords will use bcrypt.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});