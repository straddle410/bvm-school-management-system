import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin or Principal required' }, { status: 403 });
    }

    const { chargeId } = await req.json();
    if (!chargeId) return Response.json({ error: 'chargeId is required' }, { status: 400 });

    const charges = await base44.asServiceRole.entities.AdditionalCharge.filter({ id: chargeId });
    if (!charges || charges.length === 0) return Response.json({ error: 'Charge not found' }, { status: 404 });
    const charge = charges[0];

    if (charge.status === 'CANCELLED') {
      return Response.json({ error: 'Charge is already cancelled.' }, { status: 422 });
    }

    // Check if any payments exist for invoices of this charge
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      charge_id: chargeId,
      academic_year: charge.academic_year
    });

    for (const inv of invoices) {
      if ((inv.paid_amount || 0) > 0) {
        return Response.json({
          error: `Cannot cancel: payments have already been collected for this charge (e.g. student ${inv.student_name}). Reverse payments first.`
        }, { status: 422 });
      }
    }

    // Cancel all ADHOC invoices for this charge
    for (const inv of invoices) {
      await base44.asServiceRole.entities.FeeInvoice.update(inv.id, { status: 'Cancelled' });
    }

    // Mark charge cancelled
    await base44.asServiceRole.entities.AdditionalCharge.update(chargeId, { status: 'CANCELLED' });

    return Response.json({ success: true, invoices_cancelled: invoices.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});