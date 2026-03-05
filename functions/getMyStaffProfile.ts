import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Token verification ───────────────────────────────────────────────────────
const CLOCK_SKEW_MS = 2 * 60 * 1000;

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return atob(str.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

async function getSessionKey() {
  const secret = Deno.env.get('STAFF_SESSION_SECRET');
  if (!secret) throw new Error('STAFF_SESSION_SECRET is not set');
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );
}

async function verifySessionToken(token) {
  try {
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 0) return { error: 'TOKEN_INVALID' };
    const payloadB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);

    const key = await getSessionKey();
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) return { error: 'TOKEN_INVALID' };

    const payload = JSON.parse(b64urlDecode(payloadB64));
    const { staff_id, exp, iat } = payload;

    if (!staff_id || typeof exp !== 'number' || typeof iat !== 'number') return { error: 'TOKEN_INVALID' };
    if (iat > Date.now() + CLOCK_SKEW_MS) return { error: 'TOKEN_INVALID' }; // future token
    if (Date.now() > exp) return { error: 'TOKEN_EXPIRED' };

    return { staff_id, role: payload.role };
  } catch {
    return { error: 'TOKEN_INVALID' };
  }
}

/**
 * Returns profile for the logged-in staff member.
 * Identity is derived SOLELY from the signed staff_session_token.
 * Does NOT depend on base44.auth.me() — works on all devices in published app.
 *
 * Token passed via: body.staff_session_token OR Authorization: Bearer <token>
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Extract token from body or Authorization header
    let token = null;
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }
    if (!token) {
      try {
        const body = await req.json();
        token = body?.staff_session_token || null;
      } catch {}
    }

    if (!token) {
      return Response.json({ error: 'No session token provided. Please login again.', code: 'TOKEN_INVALID' }, { status: 401 });
    }

    const verified = await verifySessionToken(token);
    if (verified.error) {
      const status = verified.error === 'TOKEN_EXPIRED' ? 401 : 401;
      return Response.json({ error: 'Session expired. Please login again.', code: verified.error }, { status });
    }

    const { staff_id } = verified;

    // Load StaffAccount
    const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: staff_id });
    if (!accounts || accounts.length === 0) {
      return Response.json({ error: 'Staff account not found', code: 'STAFF_NOT_FOUND' }, { status: 404 });
    }

    const account = accounts[0];

    if (!account.is_active) {
      return Response.json({ error: 'Account inactive', code: 'ACCOUNT_INACTIVE' }, { status: 403 });
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

    return Response.json({
      staff_id: account.id,
      role,
      name: account.name,
      designation: account.designation || '',
      permissions: effectivePermissions,
      identity_source: 'staff_session_token',
    });
  } catch (error) {
    console.error('getMyStaffProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});