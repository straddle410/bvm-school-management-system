/**
 * Backfill migration: Recalculate invoice discounts to include BOTH individual AND family discounts.
 * 
 * This function:
 * 1. Fetches all active invoices for a given academic year (and optional class)
 * 2. For each invoice, aggregates ALL active StudentFeeDiscount records for that student
 * 3. Recalculates invoice.discount_total as sum of all applicable discounts
 * 4. Updates invoice.total_amount = gross_total - discount_total
 * 5. Does NOT touch payments or receipts
 * 
 * Admin-only. Run after adding new individual discounts or fixing discount records.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Reuse discount logic
function applyDiscount(feeItems, grossTotal, discount) {
  if (!discount) {
    const items = feeItems.map(fh => ({
      ...fh,
      gross_amount: fh.amount || 0,
      discount_amount: 0,
      net_amount: fh.amount || 0
    }));
    return { items, grossTotal, discountTotal: 0, netTotal: grossTotal };
  }

  let discountTotal = 0;
  const items = feeItems.map(fh => {
    const gross = fh.amount || 0;
    let discountAmt = 0;

    if (discount.scope === 'TOTAL') {
      if (discount.discount_type === 'PERCENT') {
        discountAmt = Math.round(gross * (discount.discount_value / 100));
      } else {
        const proportion = grossTotal > 0 ? gross / grossTotal : 0;
        discountAmt = Math.round(discount.discount_value * proportion);
      }
    } else if (discount.scope === 'FEE_HEAD' && fh.fee_head_id === discount.fee_head_id) {
      if (discount.discount_type === 'PERCENT') {
        discountAmt = Math.round(gross * (discount.discount_value / 100));
      } else {
        discountAmt = Math.min(discount.discount_value, gross);
      }
    }

    discountAmt = Math.min(discountAmt, gross);
    discountTotal += discountAmt;

    return {
      ...fh,
      gross_amount: gross,
      discount_amount: discountAmt,
      net_amount: gross - discountAmt
    };
  });

  if (discount.scope === 'TOTAL' && discount.discount_type === 'AMOUNT') {
    discountTotal = Math.min(discount.discount_value, grossTotal);
    let remaining = discountTotal;
    items.forEach((fh, idx) => {
      const proportion = grossTotal > 0 ? fh.gross_amount / grossTotal : 0;
      const amt = idx === items.length - 1
        ? remaining
        : Math.round(discountTotal * proportion);
      fh.discount_amount = Math.min(amt, fh.gross_amount);
      fh.net_amount = fh.gross_amount - fh.discount_amount;
      remaining -= fh.discount_amount;
    });
  }

  return { items, grossTotal, discountTotal, netTotal: grossTotal - discountTotal };
}

// Apply multiple discounts and aggregate total
function aggregateAllDiscounts(feeItems, grossTotal, allDiscountsForStudent) {
  if (!allDiscountsForStudent || allDiscountsForStudent.length === 0) {
    return applyDiscount(feeItems, grossTotal, null).discountTotal;
  }

  // For simplicity: apply each ACTIVE discount sequentially (cumulative)
  // Alternatively: calculate each independently and sum (non-cumulative)
  // Using non-cumulative (sum of independent effects) for clarity
  let totalDiscount = 0;

  for (const discount of allDiscountsForStudent) {
    if (discount.status !== 'Active') continue;

    let discountAmt = 0;

    if (discount.scope === 'TOTAL') {
      if (discount.discount_type === 'PERCENT') {
        discountAmt = Math.round(grossTotal * (discount.discount_value / 100));
      } else {
        // For AMOUNT on TOTAL, proportionally distribute
        const proportion = grossTotal > 0 ? grossTotal / grossTotal : 1;
        discountAmt = Math.round(discount.discount_value * proportion);
      }
    } else if (discount.scope === 'FEE_HEAD') {
      // Find matching fee head in items
      const feehead = feeItems.find(fh => fh.fee_head_id === discount.fee_head_id);
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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { academicYear, className } = await req.json();
    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    // Fetch all active invoices for this year (and optional class)
    const invFilter = { academic_year: academicYear, status: 'Pending' };
    if (className) invFilter.class_name = className;

    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter(invFilter);
    if (!invoices || invoices.length === 0) {
      return Response.json({ updated: 0, skipped: 0, message: 'No invoices found for this year' });
    }

    // Fetch ALL active discounts for this year
    const allDiscounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
      academic_year: academicYear,
      status: 'Active'
    });

    // Group discounts by student_id
    const discountsByStudent = {};
    for (const d of allDiscounts) {
      if (!discountsByStudent[d.student_id]) {
        discountsByStudent[d.student_id] = [];
      }
      discountsByStudent[d.student_id].push(d);
    }

    let updated = 0;
    const changes = [];

    // Recalculate each invoice
    for (const inv of invoices) {
      const gross = inv.gross_total ?? inv.total_amount ?? 0;
      const feeItems = inv.fee_heads || [];
      const discountList = discountsByStudent[inv.student_id] || [];

      // Calculate new discount total
      const newDiscountTotal = aggregateAllDiscounts(feeItems, gross, discountList);
      const newNetTotal = gross - newDiscountTotal;

      const oldDiscountTotal = inv.discount_total ?? 0;
      const oldNetTotal = inv.total_amount ?? 0;

      // Only update if changed
      if (newDiscountTotal !== oldDiscountTotal || newNetTotal !== oldNetTotal) {
        await base44.asServiceRole.entities.FeeInvoice.update(inv.id, {
          discount_total: newDiscountTotal,
          total_amount: newNetTotal,
          balance: Math.max(newNetTotal - (inv.paid_amount || 0), 0)
        });

        updated++;
        changes.push({
          studentId: inv.student_id,
          studentName: inv.student_name,
          invoiceId: inv.id,
          oldDiscount: oldDiscountTotal,
          newDiscount: newDiscountTotal,
          oldNet: oldNetTotal,
          newNet: newNetTotal,
          discountsApplied: discountList.map(d => `${d.discount_source === 'FAMILY' ? '[FAMILY]' : '[MANUAL]'} ${d.discount_type}(${d.discount_value})`).join(', ')
        });
      }
    }

    return Response.json({
      success: true,
      message: `Recalculated discounts for ${invoices.length} invoices in ${academicYear}${className ? ` / Class ${className}` : ''}`,
      updated,
      skipped: invoices.length - updated,
      changes: updated > 0 ? changes.slice(0, 10) : [] // Return first 10 changes for preview
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});