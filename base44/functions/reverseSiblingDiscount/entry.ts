import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'admin' || user.role === 'principal';
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { discount_application_id } = await req.json();
    if (!discount_application_id) return Response.json({ error: 'discount_application_id required' }, { status: 400 });

    // Get the discount record
    const discounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({ id: discount_application_id });
    const discount = discounts[0];
    if (!discount) return Response.json({ error: 'Discount not found' }, { status: 404 });

    // Mark discount as Reversed
    await base44.asServiceRole.entities.StudentFeeDiscount.update(discount_application_id, { status: 'Reversed' });

    // Find all CREDIT_ADJUSTMENT entries for this discount_application_id
    const allPayments = await base44.asServiceRole.entities.FeePayment.filter({
      academic_year: discount.academic_year,
      student_id: discount.student_id
    });

    const creditEntries = allPayments.filter(p =>
      p.entry_type === 'CREDIT_ADJUSTMENT' &&
      p.amount_paid < 0 &&
      p.status === 'Active' &&
      p.reference_no === discount_application_id
    );

    // For each credit entry, check if reversal already exists (idempotency)
    for (const creditEntry of creditEntries) {
      const reversalExists = allPayments.some(p =>
        p.entry_type === 'REVERSAL' &&
        p.reference_no === discount_application_id &&
        p.status === 'Active'
      );

      if (!reversalExists) {
        // Create reversal entry
        await base44.asServiceRole.entities.FeePayment.create({
          academic_year: discount.academic_year,
          invoice_id: creditEntry.invoice_id,
          student_id: discount.student_id,
          student_name: creditEntry.student_name,
          class_name: creditEntry.class_name,
          installment_name: creditEntry.installment_name,
          receipt_no: `CREDIT-REV-${discount_application_id.substring(0, 8)}-${Date.now()}`,
          amount_paid: -creditEntry.amount_paid, // positive (reverses the negative credit)
          payment_date: new Date().toISOString().split('T')[0],
          payment_mode: 'Credit',
          entry_type: 'REVERSAL',
          affects_cash: false,
          reference_no: discount_application_id, // same discount instance reference
          remarks: `[SIBLING-DISCOUNT-REV:${discount_application_id}] Sibling discount reversal`,
          collected_by: user?.email || user?.username || 'system',
          status: 'Active'
        });
      }
    }

    return Response.json({ success: true, discount_id: discount_application_id, status: 'Reversed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});