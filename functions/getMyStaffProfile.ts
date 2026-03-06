import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── Token verification ───────────────────────────────────────────────────────
const CLOCK_SKEW_MS = 2 * 60 * 1000;

function b64urlDecode(str) {
  // Convert URL-safe base64 to standard base64
  let standard = str.replace(/-/g, '+').replace(/_/g, '/');
  // Add padding to multiple of 4
  const pad = standard.length % 4 === 0 ? '' : '='.repeat(4 - (standard.length % 4));
  standard = standard + pad;
  // Decode using Buffer (Node/Deno compatible)
  try {
    const bytes = Uint8Array.from(atob(standard), c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch (err) {
    throw new Error(`Base64 decode failed: ${err.message}`);
  }
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
     if (dotIdx < 0) {
       console.error('[getMyStaffProfile] TOKEN_INVALID: no dot separator found, token_length=', token.length);
       return { error: 'TOKEN_INVALID' };
     }
     const payloadB64 = token.slice(0, dotIdx);
     const sigB64 = token.slice(dotIdx + 1);

     console.log(`[getMyStaffProfile] payloadB64 length=${payloadB64.length} sigB64 length=${sigB64.length}`);

     // Decode payload first for logging before signature check
     let payload = null;
     try {
       const decoded = b64urlDecode(payloadB64);
       console.log(`[getMyStaffProfile] Decoded payload string: ${decoded}`);
       payload = JSON.parse(decoded);
       const { staff_id, exp, iat } = payload;
       const now = Date.now();
       console.log(`[getMyStaffProfile] TOKEN_DECODE: staff_id=${staff_id} iat=${iat} exp=${exp} now=${now}`);
     } catch (decodeErr) {
       console.error('[getMyStaffProfile] TOKEN_INVALID: payload decode failed:', decodeErr.message);
       return { error: 'TOKEN_INVALID' };
     }

    const key = await getSessionKey();
    // Decode signature as raw bytes via atob → Uint8Array
    let standard = sigB64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = standard.length % 4 === 0 ? '' : '='.repeat(4 - (standard.length % 4));
    standard = standard + pad;
    const sigBytes = Uint8Array.from(atob(standard), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) {
      console.error(`[getMyStaffProfile] TOKEN_INVALID: signature mismatch for staff_id=${payload?.staff_id}`);
      return { error: 'TOKEN_INVALID' };
    }

    const { staff_id, exp, iat } = payload;
     if (!staff_id || typeof exp !== 'number' || typeof iat !== 'number') {
       console.error('[getMyStaffProfile] TOKEN_INVALID: missing required fields', { staff_id, exp, iat });
       return { error: 'TOKEN_INVALID' };
     }

     // Handle migration: if exp > 10^12, it's in milliseconds — convert to seconds
     let expSec = exp;
     let iatSec = iat;
     const CLOCK_SKEW_SEC = 5 * 60; // 5 min in seconds
     if (exp > 1e12) {
       expSec = Math.floor(exp / 1000);
       console.log(`[getMyStaffProfile] MIGRATION: exp in ms=${exp} converted to sec=${expSec}`);
     }
     if (iat > 1e12) {
       iatSec = Math.floor(iat / 1000);
       console.log(`[getMyStaffProfile] MIGRATION: iat in ms=${iat} converted to sec=${iatSec}`);
     }

     const nowSec = Math.floor(Date.now() / 1000);

     // Check iat is not in the future
     if (iatSec > nowSec + CLOCK_SKEW_SEC) {
       console.error(`[getMyStaffProfile] TOKEN_INVALID: future iat=${iatSec} now=${nowSec}`);
       return { error: 'TOKEN_INVALID' };
     }

     // Check expiry
     if (nowSec > expSec) {
       console.error(`[getMyStaffProfile] TOKEN_EXPIRED: staff_id=${staff_id} expSec=${expSec} nowSec=${nowSec}`);
       return { error: 'TOKEN_EXPIRED' };
     }

     console.log(`[getMyStaffProfile] TOKEN_OK: staff_id=${staff_id} role=${payload.role} expSec=${expSec} nowSec=${nowSec} valid_for=${expSec - nowSec}sec`);
     return { staff_id, role: payload.role };
  } catch (err) {
    console.error('[getMyStaffProfile] TOKEN_INVALID: unexpected error:', err.message);
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
    console.log('[getMyStaffProfile] ============ START FUNCTION ============');
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
      console.error('[getMyStaffProfile] No token in body or Authorization header');
      return Response.json({ error: 'No session token provided. Please login again.', code: 'TOKEN_MISSING' }, { status: 401 });
    }
    console.log(`[getMyStaffProfile] Token received, length=${token.length}, prefix=${token.substring(0, 30)}...`);
    console.log(`[getMyStaffProfile] STAFF_SESSION_SECRET set=${!!Deno.env.get('STAFF_SESSION_SECRET')} len=${(Deno.env.get('STAFF_SESSION_SECRET')||'').length}`);

    const verified = await verifySessionToken(token);
    if (verified.error) {
      const status = verified.error === 'TOKEN_EXPIRED' ? 401 : 401;
      return Response.json({ error: 'Session expired. Please login again.', code: verified.error }, { status });
    }

    const { staff_id } = verified;

    // Decode payload to get username & role from token
    const payloadB64 = token.slice(0, token.lastIndexOf('.'));
    const tokenPayload = JSON.parse(b64urlDecode(payloadB64));
    const tokenUsername = tokenPayload.username;
    const tokenRole = tokenPayload.role;

    // Load StaffAccount — try id first, then fallback to username
    console.log(`[getMyStaffProfile] Looking up StaffAccount id=${staff_id}`);
    let accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: staff_id });

    // Fallback: search by username
    if (!accounts || accounts.length === 0) {
      console.log(`[getMyStaffProfile] Staff id not found, trying username=${tokenUsername}`);
      if (tokenUsername) {
        accounts = await base44.asServiceRole.entities.StaffAccount.filter({ username: tokenUsername });
      }
    }

    let isProfileCreated = false;
    if (!accounts || accounts.length === 0) {
      console.warn(`[getMyStaffProfile] Staff not found anywhere, auto-creating account for id=${staff_id} username=${tokenUsername}`);
      try {
        // Create minimal staff account (upsert behavior)
        const newAccount = await base44.asServiceRole.entities.StaffAccount.create({
          id: staff_id,
          name: tokenUsername || 'Staff Member',
          username: tokenUsername || `staff_${staff_id}`,
          password_hash: '$2b$10$disabled', // Disabled — login via token only
          role: tokenRole || 'staff',
          is_active: true,
        });
        accounts = [newAccount];
        isProfileCreated = true;
        console.log(`[getMyStaffProfile] PROFILE_AUTO_CREATED for staff_id=${staff_id}`);
      } catch (createErr) {
        console.error(`[getMyStaffProfile] Failed to auto-create profile: ${createErr.message}`);
        return Response.json({ 
          error: 'Staff record not found. Please contact admin to re-create staff account.', 
          code: 'STAFF_NOT_FOUND' 
        }, { status: 404 });
      }
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
      id: account.id,
      role,
      name: account.name,
      designation: account.designation || '',
      email: account.email || '',
      mobile: account.mobile || '',
      gender: account.gender || '',
      dob: account.dob || '',
      qualification: account.qualification || '',
      experience_years: account.experience_years || null,
      joining_date: account.joining_date || '',
      staff_code: account.staff_code || '',
      photo_url: account.photo_url || '',
      address_line1: account.address_line1 || '',
      address_line2: account.address_line2 || '',
      city: account.city || '',
      state: account.state || '',
      pincode: account.pincode || '',
      emergency_contact_name: account.emergency_contact_name || '',
      emergency_contact_phone: account.emergency_contact_phone || '',
      classes: account.classes || [],
      subjects: account.subjects || [],
      is_active: account.is_active,
      permissions: effectivePermissions,
      identity_source: 'staff_session_token',
    });
  } catch (error) {
    console.error('getMyStaffProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});