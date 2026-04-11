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
    const { staff_session_token, student_ids, transport_enabled, transport_route_id, transport_route_name, transport_stop_id, transport_stop_name, annual_transport_fee } = body;

    // Verify token — fall back to base44 auth if no staff token
    let role = null;
    const payload = await verifyStaffToken(staff_session_token);
    if (payload) {
      role = (payload.role || '').toLowerCase();
    } else {
      try {
        const user = await base44.auth.me();
        if (user) role = (user.role || '').toLowerCase();
      } catch {}
    }

    if (!role) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (role !== 'admin' && role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin/Principal only' }, { status: 403 });
    }

    if (!Array.isArray(student_ids) || student_ids.length === 0) {
      return Response.json({ error: 'student_ids must be a non-empty array' }, { status: 400 });
    }

    if (typeof transport_enabled !== 'boolean') {
      return Response.json({ error: 'transport_enabled must be a boolean' }, { status: 400 });
    }

    // Build the definitive update payload on the backend
    let updatePayload;
    if (!transport_enabled) {
      // Turning transport OFF: clear ALL transport fields
      updatePayload = {
        transport_enabled: false,
        transport_route_id: null,
        transport_route_name: '',
        transport_stop_id: null,
        transport_stop_name: '',
        annual_transport_fee: 0
      };
    } else if (transport_route_id) {
      // Assigning a route: fetch route/stop from DB and calculate fee authoritatively
      const routes = await base44.asServiceRole.entities.TransportRoute.list();
      const stops = await base44.asServiceRole.entities.TransportStop.list();
      const route = routes.find(r => r.id === transport_route_id);
      const stop = transport_stop_id ? stops.find(s => s.id === transport_stop_id) : null;

      let calculatedFee = 0;
      if (route) {
        if (route.fee_type === 'yearly') calculatedFee = route.fixed_yearly_fee || 0;
        else if (route.fee_type === 'monthly') calculatedFee = (route.fixed_monthly_fee || 0) * 12;
        else if (route.fee_type === 'stop_based') calculatedFee = stop?.fee_amount || 0;
      }

      updatePayload = {
        transport_enabled: true,
        transport_route_id,
        transport_route_name: route?.name || transport_route_name || '',
        transport_stop_id: transport_stop_id || null,
        transport_stop_name: stop?.name || transport_stop_name || '',
        annual_transport_fee: calculatedFee
      };
    } else {
      // Simple toggle ON (no route specified)
      updatePayload = { transport_enabled: true };
    }

    // Update in batches of 10
    let updatedCount = 0;
    const batchSize = 10;
    for (let i = 0; i < student_ids.length; i += batchSize) {
      const batch = student_ids.slice(i, i + batchSize);
      await Promise.all(batch.map(id =>
        base44.asServiceRole.entities.Student.update(id, updatePayload)
          .then(() => { updatedCount++; })
          .catch(() => {})
      ));
    }

    return Response.json({ success: true, updatedCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});