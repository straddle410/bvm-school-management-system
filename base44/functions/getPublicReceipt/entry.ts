import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { receipt_no } = body;

    if (!receipt_no) {
      return Response.json({ error: 'receipt_no is required' }, { status: 400 });
    }

    // Direct filter by receipt_no with retry for newly created records
    let payments = [];
    let attempts = 0;
    const maxAttempts = 3;

    while ((!payments || payments.length === 0) && attempts < maxAttempts) {
      try {
        payments = await base44.asServiceRole.entities.FeePayment.filter(
          { receipt_no: receipt_no },
          '-created_date',
          10
        );
        if (payments && payments.length > 0) break;
      } catch (e) {
        console.warn(`[getPublicReceipt] Attempt ${attempts + 1} failed:`, e.message);
      }
      attempts++;
      if ((!payments || payments.length === 0) && attempts < maxAttempts) {
        // Wait 200ms before retry
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    // Fallback: normalize and search broader
    if (!payments || payments.length === 0) {
      const clean = (v) => (v || '').toString().trim().toLowerCase();
      const all = await base44.asServiceRole.entities.FeePayment.filter(
        {}, '-created_date', 3000
      );
      payments = all.filter(p => clean(p.receipt_no) === clean(receipt_no));
    }

    const payment = payments[0];
    if (!payment) {
      return Response.json({ error: 'Receipt not found', receipt_no }, { status: 404 });
    }

    const [students, schoolProfiles, invoices] = await Promise.all([
      base44.asServiceRole.entities.Student.filter({ student_id: payment.student_id }),
      base44.asServiceRole.entities.SchoolProfile.list(),
      payment.invoice_id
        ? base44.asServiceRole.entities.FeeInvoice.filter({ id: payment.invoice_id })
        : Promise.resolve([]),
    ]);

    return Response.json({
      payment,
      student: students[0] || {},
      school: schoolProfiles[0] || {},
      invoice: invoices[0] || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});