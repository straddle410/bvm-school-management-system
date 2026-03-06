import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Same token verification logic as getStudentsPaginated
async function verifyStaffToken(token) {
  try {
    const secret = Deno.env.get('STAFF_SESSION_SECRET');
    if (!secret || !token) return null;
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 0) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);

    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    let exp = payload.exp;
    if (exp > 1e12) exp = Math.floor(exp / 1000);
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { staff_session_token, student_ids, transport_enabled } = body;

    // Verify token
    const payload = await verifyStaffToken(staff_session_token);
    if (!payload) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = (payload.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin/Principal only' }, { status: 403 });
    }

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return Response.json({ error: 'student_ids must be a non-empty array' }, { status: 400 });
    }

    if (typeof transport_enabled !== 'boolean') {
      return Response.json({ error: 'transport_enabled must be a boolean' }, { status: 400 });
    }

    // Update in batches of 10
    let updatedCount = 0;
    const batchSize = 10;
    for (let i = 0; i < student_ids.length; i += batchSize) {
      const batch = student_ids.slice(i, i + batchSize);
      await Promise.all(batch.map(id =>
        base44.asServiceRole.entities.Student.update(id, { transport_enabled })
          .then(() => { updatedCount++; })
          .catch(() => {})
      ));
    }

    return Response.json({ success: true, updatedCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});