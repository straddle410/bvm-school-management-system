import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Returns authoritative role + permissions for the currently logged-in staff member.
 * Identity is derived from StaffAuthLink (base44_user_id -> staff_id).
 *
 * Auto-repair: If no StaffAuthLink exists yet (staff logged in before the link
 * system was introduced), the client may supply `staff_id` in the request body.
 * We verify the StaffAccount exists and create the link automatically.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Step 1: Get base44 platform identity (JWT — cannot be spoofed by client)
    const authUser = await base44.auth.me().catch(() => null);
    if (!authUser?.id) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Step 2: Resolve staff_id from the auth link table
    let links = await base44.asServiceRole.entities.StaffAuthLink.filter({
      base44_user_id: authUser.id,
    });

    // ── Auto-repair: create missing link from client-supplied staff_id ──────
    if (!links || links.length === 0) {
      let bodyStaffId = null;
      try {
        const body = await req.json().catch(() => ({}));
        bodyStaffId = body?.staff_id || null;
      } catch {}

      if (bodyStaffId) {
        // Verify the StaffAccount actually exists before trusting the client value
        const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: bodyStaffId });
        if (accounts && accounts.length > 0) {
          console.log(`AUTO-REPAIR: creating StaffAuthLink base44_user_id=${authUser.id} -> staff_id=${bodyStaffId}`);
          await base44.asServiceRole.entities.StaffAuthLink.create({
            base44_user_id: authUser.id,
            staff_id: bodyStaffId,
            last_login_at: new Date().toISOString(),
          });
          // Re-fetch to continue normally
          links = await base44.asServiceRole.entities.StaffAuthLink.filter({
            base44_user_id: authUser.id,
          });
        }
      }
    }

    if (!links || links.length === 0) {
      return Response.json(
        { error: 'Staff session not linked. Please log in again.', code: 'LINK_MISSING' },
        { status: 403 }
      );
    }

    const staffId = links[0].staff_id;

    // Step 3: Fetch the StaffAccount
    const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: staffId });
    if (!accounts || accounts.length === 0) {
      return Response.json({ error: 'Staff account not found', code: 'STAFF_NOT_FOUND', staff_id: staffId }, { status: 404 });
    }

    const account = accounts[0];

    if (!account.is_active) {
      return Response.json({ error: 'Account inactive' }, { status: 403 });
    }

    const role = (account.role || '').trim().toLowerCase();

    // Merge permissions: template → legacy → override
    let effectivePermissions = {};
    if (account.role_template_id) {
      try {
        const templates = await base44.asServiceRole.entities.RoleTemplate.filter({ id: account.role_template_id });
        if (templates && templates.length > 0 && templates[0].permissions) {
          effectivePermissions = { ...templates[0].permissions };
        }
      } catch {}
    }
    if (account.permissions) effectivePermissions = { ...effectivePermissions, ...account.permissions };
    if (account.permissions_override) effectivePermissions = { ...effectivePermissions, ...account.permissions_override };

    const permissionsCount = Object.keys(effectivePermissions).filter(k => effectivePermissions[k] === true).length;

    return Response.json({
      staff_id: account.id,
      role,
      name: account.name,
      designation: account.designation || '',
      permissionsCount,
      permissions: effectivePermissions,
      identity_source: 'StaffAuthLink',
    });
  } catch (error) {
    console.error('getMyStaffProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});