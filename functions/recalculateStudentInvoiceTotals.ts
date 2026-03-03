/**
 * Dynamically recalculate a student's invoice discounts whenever StudentFeeDiscount changes.
 * 
 * This function:
 * 1. Finds all active annual invoices for the student/year (status != Cancelled)
 * 2. Loads ALL active StudentFeeDiscount records (individual + family)
 * 3. Computes totalDiscount by summing all applicable discounts
 * 4. Updates invoice.discount_total and invoice.total_amount (net)
 * 5. Updates invoice.balance based on new net and existing paid_amount
 * 
 * Ensures Outstanding and Ledger reports always reflect current discounts.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function aggregateAllDiscounts(feeItems, grossTotal, allDiscountsForStudent) {
  if (!allDiscountsForStudent || allDiscountsForStudent.length === 0) {
    return 0;
  }

  // Non-cumulative: sum of independent discount effects
  let totalDiscount = 0;

  for (const discount of allDiscountsForStudent) {
    const status = (discount.status || '').toLowerCase();
    if (status !== 'active') continue;

    let discountAmt = 0;

    if (discount.scope === 'TOTAL') {
      if (discount.discount_type === 'PERCENT') {
        discountAmt = Math.round(grossTotal * (discount.discount_value / 100));
      } else {
        discountAmt = Math.round(discount.discount_value);
      }
    } else if (discount.scope === 'FEE_HEAD') {
      const feehead = feeItems?.find(fh => fh.fee_head_id === discount.fee_head_id);
      if (feehead) {
        const gross = feehead.amount || 0;
        if (discount.discount_type === 'PERCENT') {
          discountAmt = Math.round(gross * (discount.discount_value / 100));
        } else {
          discountAmt = Math.min(discount.discount_value, gross);
        }
      }
    }

    discountAmt = Math.min(discountAmt, grossTotal);
    totalDiscount += discountAmt;
  }

  return Math.min(totalDiscount, grossTotal);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Try to get user context if available; if not (backend-to-backend), allow service role
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      // Backend-to-backend call: no user context, use service role
    }
    
    // For frontend calls, enforce role. For backend-to-backend, allow service role.
    if (user) {
      const role = (user.role || '').toLowerCase();
      if (role !== 'admin' && role !== 'principal') {
        return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
      }
    }

    const { student_id, academic_year } = await req.json();
    if (!student_id || !academic_year) {
      return Response.json({ error: 'student_id and academic_year required' }, { status: 400 });
    }

    // Fetch all annual invoices for this student (excluding Cancelled)
    const allInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      student_id,
      academic_year,
      invoice_type: 'ANNUAL'
    });
    const invoices = allInvoices.filter(inv => inv.status !== 'Cancelled');

    if (!invoices || invoices.length === 0) {
      return Response.json({
        success: true,
        message: 'No active invoices found for this student/year',
        updated: 0,
        invoices: []
      });
    }

    // Fetch ALL active discounts for this student/year (individual + family)
    const allDiscounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
      student_id,
      academic_year
    });
    const activeDiscounts = allDiscounts.filter(d => (d.status || '').toLowerCase() === 'active');

    let updated = 0;
    const updatedInvoices = [];

    // Recalculate each invoice
    for (const inv of invoices) {
      const gross = inv.gross_total ?? inv.total_amount ?? 0;
      const feeItems = inv.fee_heads || [];

      // Calculate new discount total
      const newDiscountTotal = aggregateAllDiscounts(feeItems, gross, activeDiscounts);
      const newNetTotal = gross - newDiscountTotal;
      const newBalance = Math.max(newNetTotal - (inv.paid_amount || 0), 0);

      const oldDiscountTotal = inv.discount_total ?? 0;
      const oldNetTotal = inv.total_amount ?? 0;
      const oldBalance = inv.balance ?? 0;

      // Only update if changed
      if (newDiscountTotal !== oldDiscountTotal || newNetTotal !== oldNetTotal) {
        // Persist update to database
        await base44.asServiceRole.entities.FeeInvoice.update(inv.id, {
          discount_total: newDiscountTotal,
          total_amount: newNetTotal,
          balance: newBalance
        });

        // Re-fetch using get() for direct DB read (no cache)
        const invoiceAfterGet = await base44.asServiceRole.entities.FeeInvoice.get(inv.id);

        // Also re-fetch using filter() to check cache behavior
        const invoiceAfterFilterList = await base44.asServiceRole.entities.FeeInvoice.filter({ id: inv.id });
        const invoiceAfterFilter = invoiceAfterFilterList[0] || null;

        updated++;
        updatedInvoices.push({
          invoiceId: inv.id,
          installment: inv.installment_name || inv.title || 'Invoice',
          before: {
            discount_total: oldDiscountTotal,
            total_amount: oldNetTotal,
            balance: oldBalance,
            status: inv.status
          },
          computed: {
            discount_total: newDiscountTotal,
            total_amount: newNetTotal,
            balance: newBalance,
            status: inv.status
          },
          after_get: invoiceAfterGet ? {
            discount_total: invoiceAfterGet.discount_total,
            total_amount: invoiceAfterGet.total_amount,
            balance: invoiceAfterGet.balance,
            status: invoiceAfterGet.status
          } : null,
          after_filter: invoiceAfterFilter ? {
            discount_total: invoiceAfterFilter.discount_total,
            total_amount: invoiceAfterFilter.total_amount,
            balance: invoiceAfterFilter.balance,
            status: invoiceAfterFilter.status
          } : null,
          discountsApplied: activeDiscounts.length
        });
      }
    }

    return Response.json({
      success: true,
      message: `Recalculated discounts for ${student_id} in ${academic_year}`,
      updated,
      skipped: invoices.length - updated,
      invoices: updatedInvoices
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});