import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import * as bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { staff_session_token, student_ids, transport_enabled } = body;

    // Validate staff session token
    if (!staff_session_token) {
      return Response.json({ error: 'Unauthorized: no session token' }, { status: 401 });
    }

    const secret = Deno.env.get('STAFF_SESSION_SECRET') || '';
    const [headerB64, payloadB64, sig] = staff_session_token.split('.');
    if (!headerB64 || !payloadB64 || !sig) {
      return Response.json({ error: 'Unauthorized: invalid token format' }, { status: 401 });
    }

    const expectedSig = btoa(
      String.fromCharCode(...new Uint8Array(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${headerB64}.${payloadB64}.${secret}`))
      ))
    ).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    if (sig !== expectedSig) {
      return Response.json({ error: 'Unauthorized: invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(atob(payloadB64));
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