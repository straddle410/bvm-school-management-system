import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_FIELDS = [
  'mobile', 'qualification', 'address_line1', 'address_line2',
  'city', 'state', 'pincode', 'emergency_contact_name',
  'emergency_contact_phone', 'photo_url'
];

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
    if (iat > Date.now() + CLOCK_SKEW_MS) return { error: 'TOKEN_INVALID' };
    if (Date.now() > exp) return { error: 'TOKEN_EXPIRED' };

    return { staff_id };
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

    const { staff_id } = verified;

    const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: staff_id });
    if (!accounts || accounts.length === 0) {
      return Response.json({ error: 'Staff account not found', code: 'STAFF_NOT_FOUND' }, { status: 404 });
    }

    const account = accounts[0];
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