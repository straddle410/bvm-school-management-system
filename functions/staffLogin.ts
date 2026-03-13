import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

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

    // Fetch ALL staff and find by username (case-insensitive) — avoids DB case-sensitivity issues
    const allStaff = await base44.asServiceRole.entities.StaffAccount.list();
    const staff = (allStaff || []).filter(s => (s.username || '').trim().toLowerCase() === normalizedUsername);

    console.log(`[staffLogin] username="${normalizedUsername}" found=${staff.length} record(s)`);

    if (!staff || staff.length === 0) {
      console.log(`[staffLogin] USER_NOT_FOUND: "${normalizedUsername}"`);
      return Response.json({ error: 'User not found. Check username and try again.', code: 'USER_NOT_FOUND' }, { status: 401 });
    }

    const account = staff[0];
    console.log(`[staffLogin] Found staff_id=${account.id} is_active=${account.is_active} hasPasswordHash=${!!account.password_hash}`);

    if (!account.is_active) {
      console.log(`[staffLogin] ACCOUNT_INACTIVE: staff_id=${account.id}`);
      return Response.json({ error: 'Account inactive. Contact administrator.', code: 'ACCOUNT_INACTIVE' }, { status: 403 });
    }

    if (account.account_locked_until) {
      const lockTime = new Date(account.account_locked_until);
      if (lockTime > new Date()) {
        console.log(`[staffLogin] ACCOUNT_LOCKED: staff_id=${account.id} until=${account.account_locked_until}`);
        return Response.json({
          error: 'Account locked. Try again later or contact administrator.',
          code: 'ACCOUNT_LOCKED',
          locked_until: account.account_locked_until,
        }, { status: 403 });
      }
    }

    if (!account.password_hash) {
      console.log(`[staffLogin] PASSWORD_NOT_SET: staff_id=${account.id}`);
      return Response.json({ error: 'Password not set. Contact administrator to reset your password.', code: 'PASSWORD_NOT_SET' }, { status: 401 });
    }

    let passwordValid = false;
    let wasLegacyHash = false;

    // Try bcrypt first (current standard)
    if (account.password_hash?.startsWith('$2a$') || account.password_hash?.startsWith('$2b$') || account.password_hash?.startsWith('$2y$')) {
      try {
        passwordValid = await bcrypt.compare(password, account.password_hash);
      } catch (bcryptErr) {
        // Hash is malformed / corrupt (e.g. fake-bcrypt written as real bcrypt)
        console.error(`[staffLogin] PASSWORD_HASH_INVALID for staff_id=${account.id}: ${bcryptErr.message}`);
        return Response.json({
          error: 'Your password data is corrupt. Contact administrator to reset your password.',
          code: 'PASSWORD_HASH_INVALID',
        }, { status: 401 });
      }
    } else if (account.password_hash) {
      // Legacy fake bcrypt fallback
      wasLegacyHash = true;
      passwordValid = validatePasswordLegacy(password, account.password_hash);

      // If valid legacy password, upgrade to bcrypt
      if (passwordValid) {
        const newBcryptHash = await bcrypt.hash(password, 10);
        await base44.asServiceRole.entities.StaffAccount.update(account.id, {
          password_hash: newBcryptHash,
          force_password_change: true
        });
        console.log(`[staffLogin] LEGACY_PASSWORD_UPGRADED to bcrypt for staff_id=${account.id}`);
      }
    }

    console.log(`[staffLogin] passwordValid=${passwordValid} for staff_id=${account.id} (legacy=${wasLegacyHash})`);

    if (!passwordValid) {
      const newFailedAttempts = (account.failed_login_attempts || 0) + 1;
      const updateData = { failed_login_attempts: newFailedAttempts };
      if (newFailedAttempts >= 5) {
        updateData.account_locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      }
      await base44.asServiceRole.entities.StaffAccount.update(account.id, updateData);
      console.log(`[staffLogin] PASSWORD_MISMATCH: staff_id=${account.id} attempts=${newFailedAttempts}`);
      return Response.json({ error: 'Incorrect password. Please try again.', code: 'PASSWORD_MISMATCH' }, { status: 401 });
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
    try {
      const authUser = await base44.auth.me().catch(() => null);
      if (authUser?.id) {
        const existing = await base44.asServiceRole.entities.StaffAuthLink.filter({
          base44_user_id: authUser.id,
        });
        const now = new Date().toISOString();
        if (existing && existing.length > 0) {
          const link = existing[0];
          if (link.staff_id !== account.id) {
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
    } catch (linkErr) {
      console.warn('StaffAuthLink upsert skipped (no Base44 session):', linkErr?.message || linkErr);
      linkStatus = 'SKIPPED';
    }

    const normalizedRole = (account.role || '').trim().toLowerCase();

    // ── Compute effective_permissions (three-layer model) ────────────────────
    // Layer 1: RoleTemplate.permissions  — if role_template_id is set and loads successfully
    // Layer 2: StaffAccount.permissions  — legacy fallback ONLY if no template was loaded
    // Layer 3: StaffAccount.permissions_override — always applied last (additive/subtractive)
    // Admin / Principal: role check in can() bypasses all lookups — return {} here
    let effectivePermissions = {};
    if (normalizedRole !== 'admin' && normalizedRole !== 'principal') {
      let templateLoaded = false;

      if (account.role_template_id) {
        try {
          const templates = await base44.asServiceRole.entities.RoleTemplate.filter({ id: account.role_template_id });
          if (templates && templates.length > 0 && templates[0].permissions) {
            effectivePermissions = { ...templates[0].permissions };
            templateLoaded = true;
            console.log(`[staffLogin] PERMISSIONS: loaded from RoleTemplate id=${account.role_template_id} keys=${Object.keys(effectivePermissions).length}`);
          }
        } catch (tmplErr) {
          console.warn(`[staffLogin] RoleTemplate load failed, falling back to legacy: ${tmplErr.message}`);
        }
      }

      // Fall back to legacy StaffAccount.permissions ONLY if no template was found
      if (!templateLoaded) {
        effectivePermissions = { ...(account.permissions || {}) };
        console.log(`[staffLogin] PERMISSIONS: using legacy object keys=${Object.keys(effectivePermissions).length}`);
      }

      // Always apply per-user overrides last
      if (account.permissions_override && Object.keys(account.permissions_override).length > 0) {
        effectivePermissions = { ...effectivePermissions, ...account.permissions_override };
        console.log(`[staffLogin] PERMISSIONS: applied ${Object.keys(account.permissions_override).length} override(s)`);
      }
    } else {
      console.log(`[staffLogin] PERMISSIONS: admin/principal role — full bypass, effective_permissions={}`);
    }
    // iat and exp are in SECONDS (not milliseconds) — JWT standard
    const nowSec = Math.floor(Date.now() / 1000);
    const iat = nowSec;
    const exp = iat + (90 * 24 * 60 * 60); // 90 days in seconds

    // Sign long-lived session token — includes permissions so profile loads don't need extra queries
    const sessionToken = await signSessionToken({
      staff_id: account.id,
      role: normalizedRole,
      username: account.username,
      iat,
      exp,
    });

    // ── DIAGNOSTIC: Token & secret verification ───────────────────
    const secret = Deno.env.get('STAFF_SESSION_SECRET');
    console.log('[staffLogin] DIAGNOSTIC:');
    console.log(`  - TOKEN_ISSUED: length=${sessionToken.length}, first20="${sessionToken.substring(0, 20)}..."`);
    console.log(`  - SECRET: length=${secret?.length || 0}, first4="${secret?.substring(0, 4) || 'MISSING'}"`);
    console.log(`  - CLAIMS: iat=${iat} (sec), exp=${exp} (sec), exp_iso=${new Date(exp * 1000).toISOString()}`);
    console.log(`  - STAFF: staff_id=${account.id}, role=${normalizedRole}`);

    const responsePayload = {
      success: true,
      staff_id: account.id,
      username: account.username,
      name: account.name,
      full_name: account.name,
      role: normalizedRole,
      designation: account.designation,
      role_template_id: account.role_template_id,
      permissions: effectivePermissions,           // backward-compat key — existing pages read this
      effective_permissions: effectivePermissions, // new canonical key — Phase 3+ pages read this
      permissions_override: account.permissions_override,
      force_password_change: account.force_password_change || false,
      redirect_to: account.force_password_change ? 'ChangeStaffPassword' : 'Dashboard',
      link_status: linkStatus,
      // Long-lived session token — source of truth for staff identity on all devices
      staff_session_token: sessionToken,
      token_exp: exp,
      token_exp_iso: new Date(exp * 1000).toISOString(),
    };

    return Response.json(responsePayload);
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

function validatePasswordLegacy(password, hash) {
  if (!hash || !password) return false;
  return hashPasswordLegacy(password) === hash;
}

function hashPasswordLegacy(password) {
  if (!password) return '';
  return '$2b$10$' + btoa(password).substring(0, 53);
}