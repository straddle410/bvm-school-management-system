import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { action, route_id, latitude, longitude, accuracy } = body;

  // Validate staff session token
  const authHeader = req.headers.get('authorization') || req.headers.get('x-staff-token') || '';
  const staffToken = body.staff_session_token || authHeader.replace('Bearer ', '');

  if (!staffToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify token with STAFF_TOKEN_SECRET
  const STAFF_TOKEN_SECRET = Deno.env.get('STAFF_TOKEN_SECRET');
  let claims;
  try {
    const parts = staffToken.split('.');
    if (parts.length < 2) throw new Error('Invalid token');
    const payload = parts[0];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(payload.length + (4 - payload.length % 4) % 4, '='));
    claims = JSON.parse(decoded);
    if (claims.role !== 'driver') {
      return Response.json({ error: 'Only drivers can update bus location' }, { status: 403 });
    }
    if (claims.exp && Date.now() / 1000 > claims.exp) {
      return Response.json({ error: 'Session expired' }, { status: 401 });
    }
  } catch {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }

  const driver_id = claims.staff_id;

  if (action === 'stop') {
    // Mark all active locations for this driver as inactive
    const existing = await base44.asServiceRole.entities.BusLocation.filter({ driver_id, status: 'active' });
    for (const loc of existing) {
      await base44.asServiceRole.entities.BusLocation.update(loc.id, { status: 'inactive', last_updated: new Date().toISOString() });
    }
    return Response.json({ success: true, action: 'stopped' });
  }

  if (action === 'update') {
    if (!route_id || latitude == null || longitude == null) {
      return Response.json({ error: 'route_id, latitude, longitude required' }, { status: 400 });
    }

    // Fetch driver info
    const drivers = await base44.asServiceRole.entities.StaffAccount.filter({ id: driver_id });
    const driver = drivers[0];
    if (!driver) return Response.json({ error: 'Driver not found' }, { status: 404 });

    const locationData = {
      route_id,
      route_name: driver.assigned_route_name || '',
      driver_id,
      driver_name: driver.name,
      driver_phone: driver.mobile || '',
      bus_number: driver.bus_number || '',
      latitude,
      longitude,
      accuracy: accuracy || null,
      last_updated: new Date().toISOString(),
      status: 'active'
    };

    // Check if a BusLocation record exists for this route
    const existing = await base44.asServiceRole.entities.BusLocation.filter({ route_id });
    if (existing.length > 0) {
      await base44.asServiceRole.entities.BusLocation.update(existing[0].id, locationData);
      return Response.json({ success: true, id: existing[0].id });
    } else {
      const created = await base44.asServiceRole.entities.BusLocation.create(locationData);
      return Response.json({ success: true, id: created.id });
    }
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
});