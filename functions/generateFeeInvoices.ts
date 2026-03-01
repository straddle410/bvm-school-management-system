import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Apply a discount rule to a set of fee head line items and return enriched data
function applyDiscount(feeHeads, grossTotal, discount) {
  if (!discount) {
    // No discount — set gross = net, discount = 0
    const heads = feeHeads.map(fh => ({
      ...fh,
      gross_amount: fh.amount || 0,
      discount_amount: 0,
      net_amount: fh.amount || 0
    }));
    return { heads, grossTotal, discountTotal: 0, netTotal: grossTotal };
  }

  let discountTotal = 0;
  const heads = feeHeads.map(fh => {
    const gross = fh.amount || 0;
    let discountAmt = 0;

    if (discount.scope === 'TOTAL') {
      // Proportionally distribute total discount across fee heads
      const proportion = grossTotal > 0 ? gross / grossTotal : 0;
      if (discount.discount_type === 'PERCENT') {
        discountAmt = Math.round(gross * (discount.discount_value / 100));
      } else {
        discountAmt = Math.round(discount.discount_value * proportion);
      }
    } else if (discount.scope === 'FEE_HEAD' && fh.fee_head_id === discount.fee_head_id) {
      if (discount.discount_type === 'PERCENT') {
        discountAmt = Math.round(gross * (discount.discount_value / 100));
      } else {
        discountAmt = Math.min(discount.discount_value, gross);
      }
    }

    discountAmt = Math.min(discountAmt, gross); // can't discount more than gross
    discountTotal += discountAmt;

    return {
      ...fh,
      gross_amount: gross,
      discount_amount: discountAmt,
      net_amount: gross - discountAmt
    };
  });

  // For TOTAL+AMOUNT, clamp discount to gross total
  if (discount.scope === 'TOTAL' && discount.discount_type === 'AMOUNT') {
    discountTotal = Math.min(discount.discount_value, grossTotal);
    // Recalculate proportional distribution precisely
    let remaining = discountTotal;
    heads.forEach((fh, idx) => {
      const proportion = grossTotal > 0 ? fh.gross_amount / grossTotal : 0;
      const amt = idx === heads.length - 1
        ? remaining
        : Math.round(discountTotal * proportion);
      fh.discount_amount = Math.min(amt, fh.gross_amount);
      fh.net_amount = fh.gross_amount - fh.discount_amount;
      remaining -= fh.discount_amount;
    });
  }

  return {
    heads,
    grossTotal,
    discountTotal,
    netTotal: grossTotal - discountTotal
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'Admin' && user.role !== 'principal' && user.role !== 'Principal') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { feePlanId, installmentName, academicYear, className } = await req.json();
    if (!feePlanId || !installmentName || !academicYear || !className) {
      return Response.json({ error: 'feePlanId, installmentName, academicYear and className are required' }, { status: 400 });
    }

    // Load fee plan
    const plans = await base44.asServiceRole.entities.FeePlan.filter({ id: feePlanId });
    if (!plans || plans.length === 0) return Response.json({ error: 'Fee plan not found' }, { status: 404 });
    const plan = plans[0];

    if (plan.academic_year !== academicYear) {
      return Response.json({ error: `Plan academic year (${plan.academic_year}) does not match context (${academicYear})` }, { status: 422 });
    }

    const installment = (plan.installments || []).find(i => i.name === installmentName);
    if (!installment) return Response.json({ error: `Installment "${installmentName}" not found in plan` }, { status: 404 });

    // Load published students for this class + academic year
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: className,
      academic_year: academicYear,
      status: 'Published'
    });

    if (students.length === 0) return Response.json({ created: 0, skipped: 0, message: 'No published students found' });

    // Load all active discounts for this class + academic year (batch fetch)
    const discounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
      academic_year: academicYear,
      status: 'Active'
    });

    // Build discount lookup: student_id → discount
    const discountMap = {};
    for (const d of discounts) {
      discountMap[d.student_id] = d;
    }

    let created = 0, skipped = 0;
    for (const student of students) {
      if (student.academic_year && student.academic_year !== academicYear) {
        skipped++;
        continue;
      }

      // Check for duplicate invoice
      const existing = await base44.asServiceRole.entities.FeeInvoice.filter({
        student_id: student.student_id,
        academic_year: academicYear,
        installment_name: installmentName
      });
      if (existing && existing.length > 0) { skipped++; continue; }

      const feeHeads = installment.fee_heads || [];
      const grossTotal = installment.total_amount || 0;
      const discount = discountMap[student.student_id] || null;

      const { heads, discountTotal, netTotal } = applyDiscount(feeHeads, grossTotal, discount);

      await base44.asServiceRole.entities.FeeInvoice.create({
        academic_year: academicYear,
        student_id: student.student_id,
        student_name: student.name,
        class_name: student.class_name,
        section: student.section,
        installment_name: installmentName,
        due_date: installment.due_date || '',
        fee_heads: heads,
        gross_total: grossTotal,
        discount_total: discountTotal,
        total_amount: netTotal,
        paid_amount: 0,
        balance: netTotal,
        status: 'Pending',
        generated_by: user.email,
        ...(discount ? {
          discount_snapshot: {
            discount_id: discount.id,
            discount_type: discount.discount_type,
            discount_value: discount.discount_value,
            scope: discount.scope,
            fee_head_id: discount.fee_head_id || null
          }
        } : {})
      });
      created++;
    }

    return Response.json({ success: true, created, skipped, total: students.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});