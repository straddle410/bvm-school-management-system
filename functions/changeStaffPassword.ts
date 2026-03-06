import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

// ── Token verification (same as getMyStaffProfile) ───────────────────────────
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

    let payload = null;
    try {
      payload = JSON.parse(b64urlDecode(payloadB64));
    } catch {
      return { error: 'TOKEN_INVALID' };
    }

    const key = await getSessionKey();
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) return { error: 'TOKEN_INVALID' };

    const { staff_id, exp, iat } = payload;
    if (!staff_id || typeof exp !== 'number' || typeof iat !== 'number') return { error: 'TOKEN_INVALID' };
    if (iat > Date.now() + CLOCK_SKEW_MS) return { error: 'TOKEN_INVALID' };
    if (Date.now() > exp) return { error: 'TOKEN_EXPIRED' };

    return { staff_id, role: payload.role };
  } catch {
    return { error: 'TOKEN_INVALID' };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);

    // 1. Extract token from Authorization header OR body
    let token = null;
    const authHeader = req.headers.get('Authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    let body = {};
    try { body = await req.json(); } catch {}

    if (!token && body.staff_session_token) {
      token = body.staff_session_token;
    }

    if (!token) {
      console.error('[changeStaffPassword] TOKEN_MISSING');
      return Response.json({ error: 'Session token missing. Please login again.', code: 'TOKEN_MISSING' }, { status: 401 });
    }

    // 2. Verify token
    console.log('[CHANGE_PASSWORD_TOKEN]', { hasToken: !!token, tokenLength: token?.length || 0 });
    const verified = await verifySessionToken(token);
    if (verified.error) {
      console.error(`[changeStaffPassword] ${verified.error}`);
      return Response.json({ error: 'Session expired or invalid. Please login again.', code: 'STAFF_SESSION_INVALID' }, { status: 401 });
    }

    const { staff_id } = verified;
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return Response.json({ error: 'Missing required fields', code: 'MISSING_FIELDS' }, { status: 400 });
    }

    // 3. Validate new password — unified policy
    const policyOk =
      newPassword.length >= 8 &&
      /[A-Z]/.test(newPassword) &&
      /[a-z]/.test(newPassword) &&
      /[0-9]/.test(newPassword) &&
      /[^A-Za-z0-9]/.test(newPassword);

    if (!policyOk) {
      return Response.json({
        success: false,
        error: 'PASSWORD_POLICY_VIOLATION',
        message: 'Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
        code: 'PASSWORD_POLICY_VIOLATION',
      }, { status: 400 });
    }

    // 4. Reject default password reuse
    if (newPassword === 'Bvm@1234') {
      return Response.json({
        success: false,
        error: 'DEFAULT_PASSWORD_REUSE',
        message: 'You cannot reuse the default password. Please create a new secure password.',
        code: 'DEFAULT_PASSWORD_REUSE',
      }, { status: 400 });
    }

    // 5. Load staff account
    const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: staff_id });
    if (!accounts || accounts.length === 0) {
      console.error(`[changeStaffPassword] STAFF_NOT_FOUND: id=${staff_id}`);
      return Response.json({ error: 'Staff account not found.', code: 'STAFF_SESSION_INVALID' }, { status: 401 });
    }

    const account = accounts[0];

    // 6. Verify current password.
    // Staff passwords must always be hashed server-side with bcrypt. Never hash on frontend.
    console.log(`[changeStaffPassword] Verifying password for staff_id=${staff_id}, hashType=${account.password_hash?.substring(0, 4) || 'NONE'}`);
    let passwordValid = false;
    if (account.password_hash?.startsWith('$2a$') || account.password_hash?.startsWith('$2b$') || account.password_hash?.startsWith('$2y$')) {
      try {
        const startTime = Date.now();
        passwordValid = await bcrypt.compare(currentPassword, account.password_hash);
        console.log(`[changeStaffPassword] bcrypt.compare took ${Date.now() - startTime}ms, result=${passwordValid}`);
      } catch (bcryptErr) {
        console.error(`[changeStaffPassword] bcrypt.compare error: ${bcryptErr.message}`);
        return Response.json({ error: 'Account has an invalid password hash. Please contact admin to reset.', code: 'PASSWORD_HASH_INVALID' }, { status: 400 });
      }
    } else {
      // Unknown/corrupt hash — cannot verify, require admin reset
      console.error(`[changeStaffPassword] Invalid hash format for staff_id=${staff_id}`);
      return Response.json({ error: 'Account has an invalid password hash. Please contact admin to reset.', code: 'PASSWORD_HASH_INVALID' }, { status: 400 });
    }

    if (!passwordValid) {
      console.log(`[changeStaffPassword] CURRENT_PASSWORD_INCORRECT for ${account.username}`);
      return Response.json({ error: 'Current password is incorrect.', code: 'CURRENT_PASSWORD_INCORRECT' }, { status: 400 });
    }

    // 7. Reject if new password same as current (using bcrypt.compare)
    console.log(`[changeStaffPassword] Checking if new password equals current...`);
    const isSameAsCurrent = await bcrypt.compare(newPassword, account.password_hash);
    if (isSameAsCurrent) {
      console.log(`[changeStaffPassword] SAME_PASSWORD rejected`);
      return Response.json({
        success: false,
        error: 'SAME_PASSWORD',
        message: 'New password cannot be the same as the previous password.',
        code: 'SAME_PASSWORD',
      }, { status: 400 });
    }

    // 8. Hash new password with bcrypt and update.
    // Staff passwords must always be hashed server-side with bcrypt. Never hash on frontend.
    console.log(`[changeStaffPassword] Hashing new password with bcrypt...`);
    const hashStartTime = Date.now();
    const newHash = await bcrypt.hash(newPassword, 10);
    console.log(`[changeStaffPassword] bcrypt.hash took ${Date.now() - hashStartTime}ms`);

    console.log(`[changeStaffPassword] Updating staff account ${staff_id}...`);
    const updateStartTime = Date.now();
    await base44.asServiceRole.entities.StaffAccount.update(staff_id, {
      password_hash: newHash,
      password_updated_at: new Date().toISOString(),
      force_password_change: false,
    });
    console.log(`[changeStaffPassword] Update completed in ${Date.now() - updateStartTime}ms`);

    console.log(`[changeStaffPassword] SUCCESS for staff: ${account.username} (${account.role})`);

    return Response.json({ success: true });
  } catch (error) {
    console.error('[changeStaffPassword] Unexpected error:', error.message);
    return Response.json({ error: 'Internal server error', code: 'UNKNOWN_ERROR' }, { status: 500 });
  }
});