import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Verify staff session token (HMAC-signed)
async function verifyStaffToken(token) {
  const secret = Deno.env.get('STAFF_SESSION_SECRET');
  if (!secret) throw new Error('STAFF_SESSION_SECRET not set');

  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
  );

  function b64urlDecode(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/').padEnd(str.length + (4 - str.length % 4) % 4, '=');
    return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
  }

  const valid = await crypto.subtle.verify(
    'HMAC', key,
    b64urlDecode(sigB64),
    new TextEncoder().encode(payloadB64)
  );

  if (!valid) return null;

  const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));

  // Check expiry (exp is in seconds)
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;

  return payload;
}

/**
 * Bulk update homework status (Draft/Published)
 * Authenticated via staff_session_token header
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'POST required' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);

    // Verify staff session token
    const authHeader = req.headers.get('authorization') || req.headers.get('x-staff-token') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();

    let staffUser = null;
    if (token) {
      staffUser = await verifyStaffToken(token);
    }

    // Also try reading from request body if not in header (fallback)
    const body = await req.json();
    const { homework_ids = [], status, staff_session_token } = body;

    if (!staffUser && staff_session_token) {
      staffUser = await verifyStaffToken(staff_session_token);
    }

    if (!staffUser) {
      return Response.json({ error: 'Unauthorized: Invalid or expired staff session' }, { status: 401 });
    }

    if (!homework_ids || homework_ids.length === 0) {
      return Response.json({ error: 'homework_ids required' }, { status: 400 });
    }

    if (!['Draft', 'Published'].includes(status)) {
      return Response.json({ error: 'status must be Draft or Published' }, { status: 400 });
    }

    const userRole = (staffUser.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';

    // If not admin, filter to only homework owned by this staff member
    let accessibleIds = homework_ids;
    if (!isAdmin) {
      const homeworkItems = await base44.asServiceRole.entities.Homework.filter(
        { id: { $in: homework_ids } },
        'id',
        500
      );
      accessibleIds = homeworkItems
        .filter(hw => hw.assigned_by === staffUser.name)
        .map(hw => hw.id);

      if (accessibleIds.length === 0) {
        return Response.json({
          error: 'FORBIDDEN: You cannot update any of the selected homework',
          updated_count: 0,
          skipped_count: homework_ids.length
        }, { status: 403 });
      }
    }

    let updatedCount = 0;
    for (const hwId of accessibleIds) {
      await base44.asServiceRole.entities.Homework.update(hwId, { status });
      updatedCount++;
    }

    const skippedCount = homework_ids.length - accessibleIds.length;

    console.log('[BULK_HW_UPDATE]', {
      user: staffUser.username,
      user_role: userRole,
      total_requested: homework_ids.length,
      updated: updatedCount,
      skipped: skippedCount,
      status,
    });

    return Response.json({
      updated_count: updatedCount,
      skipped_count: skippedCount,
      status
    });
  } catch (error) {
    console.error('[bulkUpdateHomeworkStatus]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});