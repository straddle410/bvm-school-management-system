import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: compute discount amount from a StudentFeeDiscount record against a gross total
function computeDiscountAmount(discountRecord, gross) {
  if (!discountRecord) return 0;
  if (discountRecord.discount_type === 'PERCENT') {
    return Math.min((discountRecord.discount_value / 100) * gross, gross);
  }
  return Math.min(discountRecord.discount_value, gross);
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
    if (user && user.role !== 'admin' && user.role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin or Principal access required' }, { status: 403 });
    }

    const body = await req.json();
    const { student_id, academic_year, discount_type, discount_value, scope, fee_head_id, fee_head_name, notes } = body;

    if (!student_id || !academic_year) {
      return Response.json({ error: 'student_id and academic_year are required' }, { status: 400 });
    }
    if (!discount_type || discount_value === undefined || discount_value === null) {
      return Response.json({ error: 'discount_type and discount_value are required' }, { status: 400 });
    }
    if (discount_type === 'PERCENT' && (discount_value < 0 || discount_value > 100)) {
      return Response.json({ error: 'Percentage discount must be between 0 and 100' }, { status: 422 });
    }
    if (discount_value < 0) {
      return Response.json({ error: 'Discount value cannot be negative' }, { status: 422 });
    }
    if (scope === 'FEE_HEAD' && !fee_head_id) {
      return Response.json({ error: 'fee_head_id is required for FEE_HEAD scoped discounts' }, { status: 422 });
    }

    // ── Settled invoice guardrail ─────────────────────────────────────────
    // Load invoice for this student+AY
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      student_id,
      academic_year
    });
    const invoice = invoices[0] || null;

    if (invoice) {
      const gross = invoice.gross_total ?? invoice.total_amount ?? 0;
      const paid = invoice.paid_amount ?? 0;

      // Load existing active discount to compute current net
      const existingDiscounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
        student_id,
        academic_year,
        status: 'Active'
      });
      const existingDiscount = existingDiscounts[0] || null;
      const existingDiscountAmt = computeDiscountAmount(existingDiscount, gross);
      const net = Math.max(gross - existingDiscountAmt, 0);

      // Block if invoice is Paid or paid_amount >= net
      if (invoice.status === 'Paid' || paid >= net) {
        return Response.json({
          error: `Cannot modify discount: invoice is already settled (paid ₹${paid} of net ₹${net}). No refund/reversal mechanism exists.`
        }, { status: 422 });
      }

      // Cap AMOUNT discount at gross
      if (discount_type === 'AMOUNT' && discount_value > gross) {
        return Response.json({
          error: `Discount amount (₹${discount_value}) cannot exceed gross fee (₹${gross}).`
        }, { status: 422 });
      }

      // Validate new discount won't put net below already-paid amount
      let newDiscountAmt;
      if (discount_type === 'PERCENT') {
        newDiscountAmt = Math.min((discount_value / 100) * gross, gross);
      } else {
        newDiscountAmt = Math.min(discount_value, gross);
      }
      const newNet = Math.max(gross - newDiscountAmt, 0);
      if (paid > newNet) {
        return Response.json({
          error: `Cannot apply this discount: paid amount (₹${paid}) would exceed the new net fee (₹${newNet}). This would create an overpayment.`
        }, { status: 422 });
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // Load student for denormalization
    const students = await base44.asServiceRole.entities.Student.filter({ student_id, academic_year });
    if (!students || students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }
    const student = students[0];

    const discountData = {
      academic_year,
      student_id,
      student_name: student.name,
      class_name: student.class_name,
      discount_type,
      discount_value: parseFloat(discount_value),
      scope: scope || 'TOTAL',
      fee_head_id: scope === 'FEE_HEAD' ? fee_head_id : '',
      fee_head_name: scope === 'FEE_HEAD' ? (fee_head_name || '') : '',
      notes: notes || '',
      status: 'Active',
      created_by: user.email
    };

    // Upsert: find existing active discount for this student+AY
    const existingList = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
      student_id,
      academic_year,
      status: 'Active'
    });
    const existing = existingList[0] || null;

    let result;
    if (existing) {
      result = await base44.asServiceRole.entities.StudentFeeDiscount.update(existing.id, discountData);
    } else {
      result = await base44.asServiceRole.entities.StudentFeeDiscount.create(discountData);
    }

    return Response.json({ success: true, discount: result, action: existing ? 'updated' : 'created' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});