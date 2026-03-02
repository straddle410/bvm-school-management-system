import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Reuse discount logic from generateFeeInvoices
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'principal') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { className, academicYear, studentIds } = await req.json();
    if (!className || !academicYear) {
      return Response.json({ error: 'className and academicYear required' }, { status: 400 });
    }

    // Load current FeePlan for this class
    const plans = await base44.asServiceRole.entities.FeePlan.filter({
      class_name: className,
      academic_year: academicYear
    });
    if (!plans || plans.length === 0) {
      return Response.json({ error: `No FeePlan found for Class ${className}, ${academicYear}` }, { status: 404 });
    }
    const plan = plans[0];

    // Load students
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: className,
      academic_year: academicYear,
      status: 'Published'
    });

    let filteredStudents = students;
    if (studentIds && studentIds.length > 0) {
      filteredStudents = students.filter(s => studentIds.includes(s.student_id));
    }

    if (filteredStudents.length === 0) {
      return Response.json({ message: 'No students to regenerate' });
    }

    // Load all active discounts
    const discounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
      academic_year: academicYear,
      status: 'Active'
    });
    const discountMap = {};
    for (const d of discounts) {
      discountMap[d.student_id] = d;
    }

    // Regenerate invoices with payment guard
    let regenerated = 0, archived = 0, blocked = [];
    for (const student of filteredStudents) {
      // Get old annual invoice
      const oldInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({
        student_id: student.student_id,
        academic_year: academicYear,
        installment_name: 'Annual Fee'
      });

      if (oldInvoices && oldInvoices.length > 0) {
        const oldInvoice = oldInvoices[0];
        
        // CRITICAL: Block regeneration if payments exist
        if ((oldInvoice.paid_amount || 0) > 0) {
          blocked.push({
            student_id: student.student_id,
            student_name: student.name,
            reason: `Cannot regenerate: payments already exist (₹${oldInvoice.paid_amount} paid). Use adjustment flow instead.`
          });
          continue; // Skip this student, do NOT archive
        }

        // Safe to archive: no payments linked
        await base44.asServiceRole.entities.FeeInvoice.update(oldInvoice.id, { status: 'Cancelled' });
        archived++;
      }

      // Generate new invoice from current plan
      const feeItems = plan.fee_items || [];
      const grossTotal = plan.total_amount || 0;
      const discount = discountMap[student.student_id] || null;

      const { items, discountTotal, netTotal } = applyDiscount(feeItems, grossTotal, discount);

      await base44.asServiceRole.entities.FeeInvoice.create({
        academic_year: academicYear,
        student_id: student.student_id,
        student_name: student.name,
        class_name: student.class_name,
        section: student.section,
        installment_name: 'Annual Fee',
        due_date: plan.due_date || '',
        invoice_type: 'ANNUAL',
        fee_heads: items,
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

      regenerated++;
    }

    return Response.json({
      success: regenerated > 0 || blocked.length === 0,
      message: regenerated > 0 
        ? `Regenerated ${regenerated} invoice${regenerated !== 1 ? 's' : ''} from current plan (₹${plan.total_amount})`
        : blocked.length > 0
        ? `No invoices regenerated. All students blocked due to existing payments.`
        : 'No students to regenerate',
      archived: archived,
      regenerated: regenerated,
      blocked: blocked,
      warning: blocked.length > 0 ? `${blocked.length} student(s) have payments and cannot be regenerated. Use the adjustment flow for paid students.` : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});