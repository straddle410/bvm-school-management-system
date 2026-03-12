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
    const body = await req.json();
    const { student_id, academic_year, discount_type, discount_value, scope, fee_head_id, fee_head_name, notes, staffInfo } = body;

    // For frontend calls, enforce role. For backend-to-backend (no staffInfo), allow service role.
    if (staffInfo) {
      const role = (staffInfo.role || '').toLowerCase();
      if (!['admin', 'principal'].includes(role)) {
        return Response.json({ error: 'Forbidden: Admin or Principal access required' }, { status: 403 });
      }
    }
    const user = staffInfo || { email: 'system' };

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

    // ── ARCHIVE CHECK: Block mutations on archived years ──────────────────────
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year });
    if (academicYears && academicYears.length > 0) {
      const ayRecord = academicYears[0];
      if (ayRecord.status === 'Archived' || ayRecord.is_locked) {
        return Response.json({
          error: `Academic year ${academic_year} is archived; mutations not allowed`,
          status: 403
        }, { status: 403 });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

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
      created_by: user?.email || user?.username || 'system'
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