import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Returns the authoritative role + permissions count for a staff user.
 * Uses username (from staff_session) to look up StaffAccount — no auth required.
 * Called by Dashboard and Layout to correct stale/wrong localStorage roles.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { username } = await req.json();

    if (!username) {
      return Response.json({ error: 'username required' }, { status: 400 });
    }

    const normalizedUsername = username.trim().toLowerCase();
    const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ username: normalizedUsername });

    if (!accounts || accounts.length === 0) {
      return Response.json({ error: 'Staff account not found' }, { status: 404 });
    }

    const account = accounts[0];

    if (!account.is_active) {
      return Response.json({ error: 'Account inactive' }, { status: 403 });
    }

    const role = (account.role || '').trim().toLowerCase();
    const perms = { ...(account.permissions || {}), ...(account.permissions_override || {}) };
    const permissionsCount = Object.keys(perms).filter(k => perms[k] === true).length;

    return Response.json({
      role,
      name: account.name,
      designation: account.designation || '',
      permissionsCount,
    });
  } catch (error) {
    console.error('getMyStaffProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});