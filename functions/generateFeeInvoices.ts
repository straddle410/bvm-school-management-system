import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Apply a discount rule to fee items and return enriched breakdown
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

  // For TOTAL+AMOUNT, clamp and redistribute precisely
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { feePlanId, academicYear, className, staffInfo } = await req.json();
    const performedBy = staffInfo?.name || staffInfo?.username || 'system';
    if (!feePlanId || !academicYear || !className) {
      return Response.json({ error: 'feePlanId, academicYear and className are required' }, { status: 400 });
    }

    // Load fee plan
    const plans = await base44.asServiceRole.entities.FeePlan.filter({ id: feePlanId });
    if (!plans || plans.length === 0) return Response.json({ error: 'Fee plan not found' }, { status: 404 });
    const plan = plans[0];

    // Load school settings for transport fee
    const schoolProfiles = await base44.asServiceRole.entities.SchoolProfile.list();
    const transportFeeAmount = schoolProfiles[0]?.transport_fee_amount || 0;

    if (plan.academic_year !== academicYear) {
      return Response.json({ error: `Plan academic year (${plan.academic_year}) does not match context (${academicYear})` }, { status: 422 });
    }

    // Load published students for this class + academic year
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: className,
      academic_year: academicYear,
      status: 'Published',
      is_active: true
    });

    if (students.length === 0) return Response.json({ created: 0, skipped: 0, message: 'No published students found' });

    // Load all active discounts for this academic year (batch)
    const discounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
      academic_year: academicYear,
      status: 'Active'
    });
    const discountMap = {};
    for (const d of discounts) {
      if (!discountMap[d.student_id]) {
        discountMap[d.student_id] = [];
      }
      discountMap[d.student_id].push(d);
    }

    let created = 0, skipped = 0;
    for (const student of students) {
      // VALIDATION: Ensure student is not deleted/archived/inactive
      if (student.is_deleted || !student.is_active) {
        skipped++;
        continue;
      }

      if (student.academic_year && student.academic_year !== academicYear) {
        skipped++;
        continue;
      }

      // Duplicate guard: one annual invoice per student per year
      const existing = await base44.asServiceRole.entities.FeeInvoice.filter({
        student_id: student.student_id,
        academic_year: academicYear,
        installment_name: 'Annual Fee'
      });
      if (existing && existing.length > 0) { skipped++; continue; }

      let feeItems = [...(plan.fee_items || [])];
      let grossTotal = plan.total_amount || 0;

      // Add transport fee line if student has transport enabled
      if (student.transport_enabled && transportFeeAmount > 0) {
        feeItems = [
          ...feeItems,
          {
            fee_head_name: 'Transport',
            fee_head_id: 'transport',
            amount: transportFeeAmount,
            is_transport: true
          }
        ];
        grossTotal += transportFeeAmount;
      }

      const discountList = discountMap[student.student_id] || [];
      const discount = discountList.length > 0 ? discountList[0] : null;
      const { items, discountTotal, netTotal } = applyDiscount(feeItems, grossTotal, discount);

      await base44.asServiceRole.entities.FeeInvoice.create({
        academic_year: academicYear,
        student_id: student.student_id,
        student_name: student.name,
        class_name: student.class_name,
        section: student.section,
        installment_name: 'Annual Fee',
        due_date: plan.due_date || '',
        fee_heads: items,
        gross_total: grossTotal,
        discount_total: discountTotal,
        total_amount: netTotal,
        paid_amount: 0,
        balance: netTotal,
        status: 'Pending',
        generated_by: performedBy,
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