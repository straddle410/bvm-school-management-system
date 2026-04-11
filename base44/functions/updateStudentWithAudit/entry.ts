import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const TRACKED_FIELDS = ['roll_no', 'class_name', 'section', 'name', 'parent_phone', 'parent_email', 'address', 'status', 'transport_enabled', 'dob', 'gender', 'blood_group', 'parent_name', 'admission_date', 'username', 'student_id'];

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
    const { student_db_id, updates, staff_session_token } = body;

    // Auth: staff session token OR base44.auth.me()
    let performedBy = 'unknown';
    let userRole = null;

    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (payload) {
        userRole = (payload.role || '').toLowerCase();
        performedBy = payload.email || payload.username || 'staff';
      }
    }

    if (!userRole) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      userRole = (user.role || '').toLowerCase();
      performedBy = user.email || 'unknown';
    }

    // Only Admin / Principal can update student data
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Only Admin or Principal can modify student data.' }, { status: 403 });
    }

    if (!student_db_id || !updates) {
      return Response.json({ error: 'student_db_id and updates are required' }, { status: 400 });
    }

    // Fetch existing student record
    const existing = await base44.asServiceRole.entities.Student.filter({ id: student_db_id });
    const current = existing[0];
    if (!current) return Response.json({ error: 'Student not found.' }, { status: 404 });
    if (current.is_deleted === true) return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });

    // Compute changed fields
    const changedFields = [];
    for (const field of TRACKED_FIELDS) {
      if (field in updates) {
        const oldVal = current[field] === undefined ? null : current[field];
        const newVal = updates[field] === undefined ? null : updates[field];
        if (String(oldVal) !== String(newVal)) {
          changedFields.push({ field, old_value: String(oldVal), new_value: String(newVal) });
        }
      }
    }

    // If transport is being disabled, clear all transport fields
    if (updates.transport_enabled === false) {
      updates.transport_route_id = null;
      updates.transport_route_name = '';
      updates.transport_stop_id = null;
      updates.transport_stop_name = '';
      updates.annual_transport_fee = 0;
    }

    // If route is being changed, recalculate fee authoritatively from DB
    if (updates.transport_route_id && updates.transport_route_id !== current.transport_route_id) {
      const routes = await base44.asServiceRole.entities.TransportRoute.list();
      const stops = await base44.asServiceRole.entities.TransportStop.list();
      const route = routes.find(r => r.id === updates.transport_route_id);
      const stopId = updates.transport_stop_id || current.transport_stop_id;
      const stop = stopId ? stops.find(s => s.id === stopId) : null;
      if (route) {
        if (route.fee_type === 'yearly') updates.annual_transport_fee = route.fixed_yearly_fee || 0;
        else if (route.fee_type === 'monthly') updates.annual_transport_fee = (route.fixed_monthly_fee || 0) * 12;
        else if (route.fee_type === 'stop_based') updates.annual_transport_fee = stop?.fee_amount || 0;
        updates.transport_route_name = route.name;
        updates.transport_enabled = true;
      }
    } else if (updates.transport_stop_id && updates.transport_stop_id !== current.transport_stop_id) {
      // Stop changed on same stop_based route — recalculate
      const stops = await base44.asServiceRole.entities.TransportStop.list();
      const stop = stops.find(s => s.id === updates.transport_stop_id);
      if (stop) updates.annual_transport_fee = stop.fee_amount || 0;
    }

    // Apply the update
    const updated = await base44.asServiceRole.entities.Student.update(student_db_id, updates);

    // Create audit log entry if any field changed
    if (changedFields.length > 0) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'STUDENT_UPDATED',
        module: 'Student',
        student_id: current.student_id,
        academic_year: current.academic_year,
        changed_fields: changedFields,
        performed_by: performedBy,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        details: `Updated fields: ${changedFields.map(f => f.field).join(', ')}`
      });
    }

    return Response.json({ success: true, student: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});