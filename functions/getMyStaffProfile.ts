import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ── HMAC helpers (must match staffLogin) ────────────────────────────────────
const REPAIR_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function getHmacKey() {
  const secret = Deno.env.get('BASE44_APP_ID') || 'fallback-secret';
  const keyMaterial = new TextEncoder().encode(secret);
  return crypto.subtle.importKey('raw', keyMaterial, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function verifyRepairToken(token) {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;
    const payload = atob(payloadB64);
    const [staffId, iatStr] = payload.split(':');
    if (!staffId || !iatStr) return null;
    const iat = parseInt(iatStr, 10);
    if (Date.now() - iat > REPAIR_TOKEN_TTL_MS) return null; // expired

    const key = await getHmacKey();
    const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payload));
    return valid ? staffId : null;
  } catch {
    return null;
  }
}

/**
 * Returns authoritative role + permissions for the currently logged-in staff member.
 * Identity is derived from StaffAuthLink (base44_user_id -> staff_id).
 *
 * Auto-repair: If no StaffAuthLink exists yet, accepts a short-lived HMAC-signed
 * staff_session_token (issued by staffLogin, TTL 10 min) to auto-create the link.
 * Raw staff_id from localStorage is NEVER trusted.
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

    // ── Auto-repair via verified HMAC token (10-min TTL, signed by staffLogin) ──
    if (!links || links.length === 0) {
      let repairStaffId = null;
      try {
        const body = await req.json().catch(() => ({}));
        const token = body?.staff_session_token;
        if (token) {
          repairStaffId = await verifyRepairToken(token);
        }
      } catch {}

      if (repairStaffId) {
        // Verify the StaffAccount exists before creating the link
        const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: repairStaffId });
        if (accounts && accounts.length > 0) {
          console.log(`AUTO-REPAIR: creating StaffAuthLink base44_user_id=${authUser.id} -> staff_id=${repairStaffId}`);
          await base44.asServiceRole.entities.StaffAuthLink.create({
            base44_user_id: authUser.id,
            staff_id: repairStaffId,
            last_login_at: new Date().toISOString(),
          });
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