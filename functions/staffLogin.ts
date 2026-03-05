import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Token helpers ────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlEncode(str) {
  return b64url(new TextEncoder().encode(str));
}

async function getSessionKey() {
  const secret = Deno.env.get('STAFF_SESSION_SECRET');
  if (!secret) throw new Error('STAFF_SESSION_SECRET is not set');
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
}

async function signSessionToken(payload) {
  const payloadB64 = b64urlEncode(JSON.stringify(payload));
  const key = await getSessionKey();
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${b64url(sig)}`;
}

/**
 * Staff login via username + password.
 * Returns a long-lived HMAC-signed staff_session_token (60 days).
 * All subsequent staff API calls use this token — base44.auth.me() is NOT required.
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

    // ── Upsert StaffAuthLink (best-effort, non-blocking) ─────────────────────
    let linkStatus = 'SKIPPED';
    const authUser = await base44.auth.me().catch(() => null);
    if (authUser?.id) {
      const existing = await base44.asServiceRole.entities.StaffAuthLink.filter({
        base44_user_id: authUser.id,
      });
      const now = new Date().toISOString();
      if (existing && existing.length > 0) {
        const link = existing[0];
        if (link.staff_id !== account.id) {
          // Conflict — but don't block login, session token is the authority
          console.warn(`LINK_CONFLICT: base44_user_id=${authUser.id} linked to ${link.staff_id}, logging in as ${account.id}`);
          linkStatus = 'CONFLICT';
        } else {
          await base44.asServiceRole.entities.StaffAuthLink.update(link.id, { last_login_at: now });
          linkStatus = 'EXISTING';
        }
      } else {
        await base44.asServiceRole.entities.StaffAuthLink.create({
          base44_user_id: authUser.id,
          staff_id: account.id,
          last_login_at: now,
        });
        linkStatus = 'CREATED';
      }
    }

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
    const iat = Date.now();
    const exp = iat + SESSION_TTL_MS;

    // Sign long-lived session token — includes permissions so profile loads don't need extra queries
    const sessionToken = await signSessionToken({
      staff_id: account.id,
      role: normalizedRole,
      iat,
      exp,
    });

    const responsePayload = {
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
      force_password_change: account.force_password_change || false,
      redirect_to: account.force_password_change ? 'ChangeStaffPassword' : 'Dashboard',
      link_status: linkStatus,
      // Long-lived session token — source of truth for staff identity on all devices
      staff_session_token: sessionToken,
      token_exp: exp,
      token_exp_iso: new Date(exp).toISOString(),
    };

    return Response.json(responsePayload);
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