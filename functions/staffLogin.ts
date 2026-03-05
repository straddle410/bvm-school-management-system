import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Staff login via username + password.
 * On success, upserts a StaffAuthLink record linking base44_user_id -> staff_id.
 * This is the ONLY authoritative server-side identity mapping.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ error: 'Username and password required' }, { status: 400 });
    }

    const normalizedUsername = username.trim().toLowerCase();

    const staff = await base44.asServiceRole.entities.StaffAccount.filter({
      username: normalizedUsername,
    });

    if (!staff || staff.length === 0) {
      return Response.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    const account = staff[0];

    if (!account.is_active) {
      return Response.json({ error: 'Account inactive. Contact administrator.' }, { status: 403 });
    }

    if (account.account_locked_until) {
      const lockTime = new Date(account.account_locked_until);
      if (lockTime > new Date()) {
        return Response.json({
          error: 'Account locked. Try again later or contact administrator.',
          locked_until: account.account_locked_until,
        }, { status: 403 });
      }
    }

    const passwordValid = validatePassword(password, account.password_hash);

    if (!passwordValid) {
      const newFailedAttempts = (account.failed_login_attempts || 0) + 1;
      const updateData = { failed_login_attempts: newFailedAttempts };
      if (newFailedAttempts >= 5) {
        updateData.account_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await base44.asServiceRole.entities.StaffAccount.update(account.id, updateData);
      return Response.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    // Successful auth — update login metadata
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    await base44.asServiceRole.entities.StaffAccount.update(account.id, {
      failed_login_attempts: 0,
      account_locked_until: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: clientIp,
    });

    // ── Upsert StaffAuthLink ─────────────────────────────────────────────────
    // base44.auth.me() returns the platform user making this request.
    // This binds the base44 session identity -> StaffAccount.id permanently.
    const authUser = await base44.auth.me().catch(() => null);
    if (authUser?.id) {
      const existing = await base44.asServiceRole.entities.StaffAuthLink.filter({
        base44_user_id: authUser.id,
      });
      const now = new Date().toISOString();
      if (existing && existing.length > 0) {
        const link = existing[0];
        if (link.staff_id !== account.id) {
          console.error(
            `LINK_CONFLICT: base44_user_id=${authUser.id} already linked to staff_id=${link.staff_id}, ` +
            `attempted login as staff_id=${account.id} (username=${account.username})`
          );
          return Response.json({
            error: 'This platform session is already linked to a different staff account. ' +
                   'Please use a separate browser profile or contact your administrator.',
            code: 'LINK_CONFLICT',
          }, { status: 403 });
        }
        // Same staff_id — refresh timestamp
        await base44.asServiceRole.entities.StaffAuthLink.update(link.id, { last_login_at: now });
        linkStatus = 'EXISTING';
      } else {
        // No link yet — create one
        await base44.asServiceRole.entities.StaffAuthLink.create({
          base44_user_id: authUser.id,
          staff_id: account.id,
          last_login_at: now,
        });
        linkStatus = 'CREATED';
      }
      linkBase44UserId = authUser.id;
    }
    // If auth.me() fails (no platform session) we skip the link — profile/update
    // will return 401 until a proper session is established.

    // Resolve effective permissions
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

    const normalizedRole = (account.role || '').trim().toLowerCase();

    if (account.force_password_change) {
      return Response.json({
        success: true,
        force_password_change: true,
        staff_id: account.id,
        username: account.username,
        name: account.name,
        full_name: account.name,
        role: normalizedRole,
        designation: account.designation,
        role_template_id: account.role_template_id,
        permissions: effectivePermissions,
        redirect_to: 'ChangeStaffPassword',
      });
    }

    return Response.json({
      success: true,
      staff_id: account.id,
      username: account.username,
      name: account.name,
      full_name: account.name,
      role: normalizedRole,
      designation: account.designation,
      role_template_id: account.role_template_id,
      permissions: effectivePermissions,
      permissions_override: account.permissions_override,
      force_password_change: false,
      redirect_to: 'Dashboard',
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

function validatePassword(password, hash) {
  if (!hash || !password) return false;
  return hashPassword(password) === hash;
}

function hashPassword(password) {
  if (!password) return '';
  return '$2b$10$' + btoa(password).substring(0, 53);
}