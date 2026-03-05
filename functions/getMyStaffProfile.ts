import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Returns authoritative role + permissions for a staff member.
 *
 * Lookup priority (most → least stable):
 *   1. staff_id  — direct record ID lookup (never changes, most reliable)
 *   2. email     — unique per person, stable across username renames
 *   3. username  — last resort (usernames can change or be reused)
 *
 * At least one of staff_id / email / username must be provided.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, email, username } = await req.json();

    if (!staff_id && !email && !username) {
      return Response.json({ error: 'staff_id, email, or username required' }, { status: 400 });
    }

    let account = null;

    // 1) Direct ID lookup — most stable
    if (staff_id) {
      try {
        const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: staff_id });
        if (accounts && accounts.length > 0) account = accounts[0];
      } catch {}
    }

    // 2) Email lookup — stable even if username changes
    if (!account && email) {
      const normalized = email.trim().toLowerCase();
      const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ email: normalized });
      if (accounts && accounts.length > 0) account = accounts[0];
    }

    // 3) Username lookup — last resort fallback
    if (!account && username) {
      const normalized = username.trim().toLowerCase();
      const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ username: normalized });
      if (accounts && accounts.length > 0) account = accounts[0];
    }

    if (!account) {
      return Response.json({ error: 'Staff account not found' }, { status: 404 });
    }

    if (!account.is_active) {
      return Response.json({ error: 'Account inactive' }, { status: 403 });
    }

    const role = (account.role || '').trim().toLowerCase();

    // Merge permissions: template → legacy → override
    let effectivePermissions = {};
    if (account.permissions) {
      effectivePermissions = { ...effectivePermissions, ...account.permissions };
    }
    if (account.permissions_override) {
      effectivePermissions = { ...effectivePermissions, ...account.permissions_override };
    }
    const permissionsCount = Object.keys(effectivePermissions).filter(k => effectivePermissions[k] === true).length;

    return Response.json({
      staff_id: account.id,   // echo back canonical ID so client can correct stale session
      role,
      name: account.name,
      designation: account.designation || '',
      permissionsCount,
      lookup_method: staff_id && account.id === staff_id
        ? 'staff_id'
        : (email ? 'email' : 'username'),
    });
  } catch (error) {
    console.error('getMyStaffProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});