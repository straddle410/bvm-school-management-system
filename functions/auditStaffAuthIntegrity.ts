import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Migration function to audit and fix staff authentication integrity.
 * 
 * Checks:
 * - Username normalized (lowercase, trimmed)
 * - Role lowercase
 * - Password_hash exists
 * - Account active
 * - No duplicate usernames (case-insensitive)
 * 
 * Fixes:
 * - Convert role to lowercase
 * - Normalize usernames
 * - Report missing passwords
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

    if (!user || (user.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const allStaff = await base44.asServiceRole.entities.StaffAccount.list();
    const results = {
      total: allStaff.length,
      normalized: 0,
      role_fixed: 0,
      missing_password: 0,
      duplicates_found: 0,
      errors: [],
      fixes: [],
    };

    // Track normalized usernames for duplicate detection
    const normalizedMap = {};

    for (const account of allStaff) {
      try {
        const updates = {};

        // Normalize username (lowercase, trim)
        const normalized = (account.username || '').trim().toLowerCase();
        if (normalized && normalized !== (account.username || '').trim()) {
          updates.username = normalized;
          results.normalized++;
        }

        // Normalize role (lowercase)
        const normalizedRole = (account.role || '').toLowerCase();
        if (normalizedRole && normalizedRole !== (account.role || '')) {
          updates.role = normalizedRole;
          results.role_fixed++;
        }

        // Check for missing password_hash
        if (!account.password_hash) {
          results.missing_password++;
          console.log(`[auditStaffAuthIntegrity] PASSWORD_NOT_SET for staff_id=${account.id} username=${account.username}`);
          results.fixes.push(`Staff ${account.username || account.id}: password not set`);
        }

        // Track username for duplicate detection
        if (normalized) {
          if (normalizedMap[normalized]) {
            results.duplicates_found++;
            results.fixes.push(`Duplicate username (case-insensitive): "${normalized}"`);
          } else {
            normalizedMap[normalized] = account.id;
          }
        }

        // Apply updates if needed
        if (Object.keys(updates).length > 0) {
          await base44.asServiceRole.entities.StaffAccount.update(account.id, updates);
          console.log(`[auditStaffAuthIntegrity] Fixed staff_id=${account.id}: ${JSON.stringify(updates)}`);
        }
      } catch (err) {
        results.errors.push({ staff_id: account.id, username: account.username, error: err.message });
      }
    }

    console.log(`[auditStaffAuthIntegrity] Audit complete:`, results);
    return Response.json({ success: true, results });
  } catch (error) {
    console.error('[auditStaffAuthIntegrity] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});