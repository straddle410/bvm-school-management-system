import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'principal', 'ceo'].includes((user.role || '').toLowerCase())) {
      return Response.json({ error: 'Unauthorized: Admin/Principal/CEO access required' }, { status: 403 });
    }

    const body = await req.json();
    const { student_ids, stop_id, staff_session_token } = body;

    if (!Array.isArray(student_ids) || student_ids.length === 0 || !stop_id) {
      return Response.json({ error: 'student_ids array and stop_id are required' }, { status: 400 });
    }

    // Fetch stop and its route
    const stops = await base44.asServiceRole.entities.TransportStop.filter({ id: stop_id });
    const targetStop = stops[0];
    if (!targetStop) {
      return Response.json({ error: 'TransportStop not found' }, { status: 404 });
    }

    const routes = await base44.asServiceRole.entities.TransportRoute.filter({ id: targetStop.route_id });
    const targetRoute = routes[0];
    if (!targetRoute) {
      return Response.json({ error: 'TransportRoute not found' }, { status: 404 });
    }

    // Calculate fee for this stop/route
    let annual_transport_fee = 0;
    if (targetRoute.fee_type === 'yearly') {
      annual_transport_fee = targetRoute.fixed_yearly_fee || 0;
    } else if (targetRoute.fee_type === 'monthly') {
      annual_transport_fee = (targetRoute.fixed_monthly_fee || 0) * 12;
    } else if (targetRoute.fee_type === 'stop_based') {
      annual_transport_fee = targetStop.fee_amount || 0;
    }

    let updatedCount = 0;
    const errors = [];

    for (const student_id of student_ids) {
      try {
        const updates = {
          transport_enabled: true,
          transport_route_id: targetRoute.id,
          transport_stop_id: targetStop.id,
          transport_route_name: targetRoute.name,
          transport_stop_name: targetStop.name,
          annual_transport_fee,
        };

        const updateRes = await base44.functions.invoke('updateStudentWithAudit', {
          student_db_id: student_id,
          updates,
          staff_session_token,
        });

        if (updateRes.data?.error) {
          errors.push(`${student_id}: ${updateRes.data.error}`);
        } else {
          updatedCount++;
        }
      } catch (e) {
        errors.push(`${student_id}: ${e.message}`);
      }
    }

    return Response.json({
      success: errors.length === 0,
      updatedCount,
      errors,
      stop_name: targetStop.name,
      route_name: targetRoute.name,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});