import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Function to verify staff session token validity and extract user payload
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
    const { date, class_name, section, academic_year, staff_session_token } = body;

    // Auth: staff session token OR base44.auth.me()
    let user = null;

    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (payload) {
        user = { email: payload.email, role: payload.role };
      }
    }

    if (!user) {
      const baseUser = await base44.auth.me().catch(() => null);
      if (baseUser) {
        user = baseUser;
      }
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role validation: only admin/principal can unlock
    const userRole = (user.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
    }

    if (!date || !class_name || !section || !academic_year) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch all attendance records matching the criteria
    const records = await base44.asServiceRole.entities.Attendance.filter({
      date,
      class_name,
      section,
      academic_year
    });

    // Unlock all matching records
    const unlockPromises = records.map(record =>
      base44.asServiceRole.entities.Attendance.update(record.id, {
        is_locked: false,
        unlocked_by: user.email,
        unlocked_at: new Date().toISOString()
      })
    );

    const updatedRecords = await Promise.all(unlockPromises);

    return Response.json({
      success: true,
      recordsUnlocked: updatedRecords.length,
      message: `Unlocked ${updatedRecords.length} attendance record(s) for ${class_name}-${section} on ${date}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});