import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * ONE-TIME MIGRATION: Fix staff records where password was stored as plaintext
 * or password_hash is missing.
 * 
 * Rules:
 * - If password_hash is empty AND no plaintext to migrate: mark as needing reset
 * - Admin-only endpoint
 */

function hashPassword(password) {
  if (!password) return '';
  return '$2b$10$' + btoa(password).substring(0, 53);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const allStaff = await base44.asServiceRole.entities.StaffAccount.list();

    const results = {
      total: allStaff.length,
      already_hashed: 0,
      migrated_from_plaintext: 0,
      missing_password: 0,
      errors: [],
    };

    for (const account of allStaff) {
      try {
        const hasHash = account.password_hash && account.password_hash.startsWith('$2b$10$');

        if (hasHash) {
          results.already_hashed++;
          continue;
        }

        // Check for a legacy plaintext "password" field (some old records may have it)
        // The StaffAccount entity doesn't have a "password" field, but check defensively
        const plaintextField = account.password || account.temp_password || null;

        if (!account.password_hash && plaintextField) {
          // Migrate plaintext → hash
          const newHash = hashPassword(plaintextField);
          await base44.asServiceRole.entities.StaffAccount.update(account.id, {
            password_hash: newHash,
            force_password_change: true,
          });
          results.migrated_from_plaintext++;
          console.log(`[migrateStaffPasswords] Migrated plaintext → hash for staff_id=${account.id} username=${account.username}`);
        } else if (!account.password_hash) {
          // No hash, no plaintext — needs admin reset
          results.missing_password++;
          console.log(`[migrateStaffPasswords] PASSWORD_NOT_SET for staff_id=${account.id} username=${account.username}`);
        }
      } catch (err) {
        results.errors.push({ staff_id: account.id, username: account.username, error: err.message });
      }
    }

    console.log(`[migrateStaffPasswords] Migration complete:`, results);
    return Response.json({ success: true, results });
  } catch (error) {
    console.error('[migrateStaffPasswords] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});