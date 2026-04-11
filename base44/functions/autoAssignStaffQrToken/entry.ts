import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    const entityId = body?.event?.entity_id;
    if (!entityId) {
      return Response.json({ error: 'No entity_id in payload' }, { status: 400 });
    }

    // Fetch the staff record
    const staff = await base44.asServiceRole.entities.StaffAccount.get(entityId);
    if (!staff) {
      return Response.json({ error: 'Staff not found' }, { status: 404 });
    }

    // Only assign if qr_token is missing
    if (staff.qr_token) {
      return Response.json({ message: 'qr_token already exists, skipping' });
    }

    const qr_token = crypto.randomUUID();
    await base44.asServiceRole.entities.StaffAccount.update(entityId, { qr_token });

    return Response.json({ success: true, qr_token });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});