import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_FIELDS = [
  'mobile', 'alternative_phone', 'email', 'qualification', 'address_line1', 'address_line2',
  'city', 'state', 'pincode', 'emergency_contact_name',
  'emergency_contact_phone', 'photo_url'
];

const CLOCK_SKEW_MS = 2 * 60 * 1000;

function b64urlDecode(str) {
  // Convert URL-safe base64 to standard base64
  const standard = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding
  const pad = standard.length % 4 === 0 ? '' : '='.repeat(4 - (standard.length % 4));
  // Use Deno's base64 decoder
  const bytes = new Uint8Array(atob(standard + pad).split('').map(c => c.charCodeAt(0)));
  return new TextDecoder().decode(bytes);
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
    let standard = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = standard.length % 4 === 0 ? '' : '='.repeat(4 - (standard.length % 4));
    standard = standard + pad;
    const sigBytes = Uint8Array.from(atob(standard), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) return { error: 'TOKEN_INVALID' };

    const payload = JSON.parse(b64urlDecode(payloadB64));
    const { staff_id, exp, iat, username, role } = payload;

    if (!staff_id || typeof exp !== 'number' || typeof iat !== 'number') return { error: 'TOKEN_INVALID' };

    // Handle both ms and sec timestamps (migration compatibility)
    const CLOCK_SKEW_SEC = 5 * 60;
    const nowSec = Math.floor(Date.now() / 1000);
    let expSec = exp > 1e12 ? Math.floor(exp / 1000) : exp;
    let iatSec = iat > 1e12 ? Math.floor(iat / 1000) : iat;

    if (iatSec > nowSec + CLOCK_SKEW_SEC) return { error: 'TOKEN_INVALID' };
    if (nowSec > expSec) return { error: 'TOKEN_EXPIRED' };

    return { staff_id, username, role };
  } catch {
    return { error: 'TOKEN_INVALID' };
  }
}

/**
 * Updates the profile of the logged-in staff member.
 * Identity derived SOLELY from signed staff_session_token — no auth.me() needed.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Extract token + payload from body
    const rawBody = await req.json();
    const token = rawBody?.staff_session_token || null;

    if (!token) {
      return Response.json({ error: 'No session token. Please login again.', code: 'TOKEN_INVALID' }, { status: 401 });
    }

    const verified = await verifySessionToken(token);
    if (verified.error) {
      return Response.json({ error: 'Session expired. Please login again.', code: verified.error }, { status: 401 });
    }

    const { staff_id, username, role } = verified;

    // Lookup StaffAccount — use .get() for id (filter({id}) doesn't work on built-in fields)
    let account = null;
    try {
      const fetched = await base44.asServiceRole.entities.StaffAccount.get(staff_id);
      if (fetched && fetched.id) account = fetched;
    } catch {}

    // Fallback: search by username
    if (!account && username) {
      try {
        const byUsername = await base44.asServiceRole.entities.StaffAccount.filter({ username });
        if (byUsername && byUsername.length > 0) account = byUsername[0];
      } catch {}
    }

    if (!account) {
      return Response.json({ error: 'Staff account not found', code: 'STAFF_NOT_FOUND' }, { status: 404 });
    }
    if (!account.is_active) {
      return Response.json({ error: 'Account inactive' }, { status: 403 });
    }

    // Whitelist only allowed fields — ignore everything else including token
    const updateData = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in rawBody) updateData[field] = rawBody[field];
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await base44.asServiceRole.entities.StaffAccount.update(account.id, updateData);

    return Response.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('updateMyProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});