import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const staffSession = JSON.parse(req.headers.get('X-Staff-Session') || '{}');
    
    if (!staffSession.id || !staffSession.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userRole = (staffSession.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { chargeId } = await req.json();
    if (!chargeId) return Response.json({ error: 'chargeId is required' }, { status: 400 });

    const charge = await base44.asServiceRole.entities.AdditionalCharge.get(chargeId);
    if (!charge) return Response.json({ error: 'Charge not found' }, { status: 404 });
    if (charge.status === 'CANCELLED') return Response.json({ error: 'Already cancelled' }, { status: 422 });

    // ── ARCHIVE CHECK: Block mutations on archived years ──────────────────────
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ year: charge.academic_year });
    if (academicYears && academicYears.length > 0) {
     const ayRecord = academicYears[0];
     if (ayRecord.status === 'Archived' || ayRecord.is_locked) {
       return Response.json({
         error: `Academic year ${charge.academic_year} is archived; mutations not allowed`,
         status: 403
       }, { status: 403 });
     }
    }
    // ──────────────────────────────────────────────────────────────────────

    // Check if any payments exist for invoices of this charge
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      charge_id: chargeId,
      academic_year: charge.academic_year
    });
    const invoiceIds = invoices.map(i => i.id);

    for (const invoiceId of invoiceIds) {
      const payments = await base44.asServiceRole.entities.FeePayment.filter({ invoice_id: invoiceId });
      if (payments.length > 0) {
        return Response.json({ error: 'Cannot cancel: payments already recorded for this charge' }, { status: 422 });
      }
    }

    // Cancel all invoices
    for (const inv of invoices) {
      await base44.asServiceRole.entities.FeeInvoice.update(inv.id, { status: 'Cancelled' });
    }

    // Cancel the charge
    await base44.asServiceRole.entities.AdditionalCharge.update(chargeId, { status: 'CANCELLED' });

    return Response.json({ success: true, invoicesCancelled: invoices.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});