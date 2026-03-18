import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
    const { staff_session_token, academic_year, class_name, section } = body;

    // Auth: admin/principal only
    let performedBy = 'unknown';
    let staffRole = '';

    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (!payload) return Response.json({ error: 'Invalid or expired session token' }, { status: 401 });
      staffRole = (payload.role || '').toLowerCase();
      performedBy = payload.email || payload.username || 'staff';
    } else {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      staffRole = (user.role || '').toLowerCase();
      performedBy = user.email || 'unknown';
    }

    if (staffRole !== 'admin' && staffRole !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin or Principal access required' }, { status: 403 });
    }

    if (!academic_year || !class_name || !section) {
      return Response.json({ error: 'academic_year, class_name, section are required' }, { status: 400 });
    }

    // Fetch all students in this class/section/year
    const allStudents = await base44.asServiceRole.entities.Student.filter(
      { class_name, section, academic_year },
      'roll_no',
      10000
    );

    const EXCLUDED_STATUSES = ['Archived', 'Passed Out', 'Transferred'];

    // Find only deleted/archived/passed-out/transferred students that still have a roll_no
    const toClean = allStudents.filter(s =>
      (s.is_deleted === true || EXCLUDED_STATUSES.includes(s.status)) &&
      s.roll_no != null && s.roll_no !== ''
    );

    if (toClean.length === 0) {
      return Response.json({ success: true, cleaned_count: 0, affected_students: [] });
    }

    const affected = [];
    for (const s of toClean) {
      await base44.asServiceRole.entities.Student.update(s.id, { roll_no: null });
      affected.push({ id: s.id, name: s.name, old_roll_no: s.roll_no, status: s.status });
    }

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'CLEANUP_DELETED_ROLL_NOS',
      module: 'Student',
      class_name,
      section,
      academic_year,
      performed_by: performedBy,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().split('T')[0],
      details: `Cleared roll numbers from ${toClean.length} deleted/archived student(s) in Class ${class_name}-${section} (${academic_year}). IDs: ${affected.map(a => a.id).join(', ')}`
    });

    return Response.json({ success: true, cleaned_count: affected.length, affected_students: affected });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});