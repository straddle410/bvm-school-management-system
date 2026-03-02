import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const isAdmin = user.role === 'admin' || user.role === 'principal';
    if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { family_id, action } = await req.json(); // action = 'apply' | 'remove'
    if (!family_id) return Response.json({ error: 'family_id required' }, { status: 400 });
    if (!['apply', 'remove'].includes(action)) return Response.json({ error: 'action must be apply or remove' }, { status: 400 });

    const families = await base44.asServiceRole.entities.FeeFamily.filter({ id: family_id });
    const family = families[0];
    if (!family) return Response.json({ error: 'Family not found' }, { status: 404 });

    if (action === 'remove') {
      // Archive all sibling discounts for these students in this AY
      const existingDiscounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
        academic_year: family.academic_year
      });
      const siblingDiscounts = existingDiscounts.filter(d =>
        family.student_ids.includes(d.student_id) && d.notes?.startsWith('[SIBLING]')
      );

      const results = [];
      for (const d of siblingDiscounts) {
        const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
          student_id: d.student_id,
          academic_year: family.academic_year
        });
        const inv = invoices.find(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL');
        const isFullyPaid = inv && inv.status === 'Paid';

        // Archive the discount record
        await base44.asServiceRole.entities.StudentFeeDiscount.update(d.id, { status: 'Archived' });

        if (isFullyPaid && inv) {
          // Find and reverse the DISCOUNT_CREDIT ledger entry using family_id reference
          const creditPayments = await base44.asServiceRole.entities.FeePayment.filter({
            invoice_id: inv.id,
            student_id: d.student_id,
            academic_year: family.academic_year
          });
          const creditEntry = creditPayments.find(p => 
            p.remarks?.includes(`[SIBLING-FAMILY:${family_id}]`) && 
            p.amount_paid < 0 &&
            p.status === 'Active'
          );
          if (creditEntry) {
            // Create reversal entry (positive = reverses the negative credit)
            await base44.asServiceRole.entities.FeePayment.create({
              academic_year: family.academic_year,
              invoice_id: inv.id,
              student_id: d.student_id,
              student_name: creditEntry.student_name,
              class_name: creditEntry.class_name,
              installment_name: creditEntry.installment_name,
              receipt_no: `CREDIT-REV-FAM${family_id.substring(0, 8)}-${Date.now()}`,
              amount_paid: -creditEntry.amount_paid, // positive (reversal)
              payment_date: new Date().toISOString().split('T')[0],
              payment_mode: 'Reversal',
              reference_no: family_id, // same family reference for tracking
              remarks: `[SIBLING-FAMILY:${family_id}] Family discount credit reversal`,
              collected_by: user.email,
              status: 'Active'
            });
          }
        } else if (inv) {
          // Recalculate invoice (remove discount)
          const gross = inv.gross_total ?? inv.total_amount ?? 0;
          const paidAmt = inv.paid_amount ?? 0;
          const balance = Math.max(gross - paidAmt, 0);
          let status = inv.status;
          if (paidAmt >= gross && gross >= 0 && paidAmt > 0) status = 'Paid';
          else if (paidAmt > 0) status = 'Partial';
          else status = 'Pending';

          await base44.asServiceRole.entities.FeeInvoice.update(inv.id, {
            discount_total: 0,
            total_amount: gross,
            balance,
            status
          });
        }
        results.push({ student_id: d.student_id, status: 'removed' });
      }

      await base44.asServiceRole.entities.FeeFamily.update(family_id, { sibling_discount_applied: false });
      return Response.json({ success: true, action: 'removed', results });
    }

    // APPLY
    if (!family.sibling_discount_value || !family.sibling_discount_type) {
      return Response.json({ error: 'Family has no sibling discount configured' }, { status: 400 });
    }

    const results = [];
    for (const student_id of (family.student_ids || [])) {
      // Get student info
      const students = await base44.asServiceRole.entities.Student.filter({ student_id });
      const student = students[0];
      if (!student) { results.push({ student_id, status: 'not_found' }); continue; }

      // Get annual invoice for guardrail check
      const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
        student_id,
        academic_year: family.academic_year
      });
      const inv = invoices.find(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL');
      const isFullyPaid = inv && inv.status === 'Paid';

      // Compute cap check
      const gross = inv?.gross_total ?? inv?.total_amount ?? 0;
      if (family.sibling_discount_type === 'AMOUNT' && gross > 0 && family.sibling_discount_value > gross) {
        results.push({ student_id, status: 'skipped_exceeds_gross' }); continue;
      }

      // Archive any existing sibling discount for this student+AY
      const existingDiscounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({
        student_id,
        academic_year: family.academic_year
      });
      for (const d of existingDiscounts) {
        if (d.notes?.startsWith('[SIBLING]') && d.status === 'Active') {
          await base44.asServiceRole.entities.StudentFeeDiscount.update(d.id, { status: 'Archived' });
        }
      }

      // Calculate discount amount
      const gross = inv?.gross_total ?? inv?.total_amount ?? 0;
      let discountAmt = 0;
      if (family.sibling_discount_type === 'PERCENT') {
        discountAmt = Math.min((family.sibling_discount_value / 100) * gross, gross);
      } else {
        discountAmt = Math.min(family.sibling_discount_value, gross);
      }

      // Create new sibling discount
      await base44.asServiceRole.entities.StudentFeeDiscount.create({
        academic_year: family.academic_year,
        student_id,
        student_name: student.name,
        class_name: student.class_name,
        discount_type: family.sibling_discount_type,
        discount_value: family.sibling_discount_value,
        scope: family.sibling_discount_scope || 'TOTAL',
        fee_head_id: family.sibling_discount_fee_head_id || '',
        fee_head_name: family.sibling_discount_fee_head_name || '',
        notes: `[SIBLING] Family: ${family.family_name}`,
        discount_source: 'FAMILY',
        family_id: family_id,
        status: 'Active',
        created_by: user.email
      });

      // If fully paid, create ledger credit instead of applying to invoice
      if (isFullyPaid) {
        // Check if credit already exists for this family discount (idempotency)
        const existingCredits = await base44.asServiceRole.entities.FeePayment.filter({
          invoice_id: inv.id,
          student_id,
          academic_year: family.academic_year
        });
        const creditExists = existingCredits.some(p => 
          p.remarks?.includes(`[SIBLING-FAMILY:${family_id}]`) && 
          p.amount_paid < 0 &&
          p.status === 'Active'
        );

        if (!creditExists) {
          // Create DISCOUNT_CREDIT ledger entry with family reference
          await base44.asServiceRole.entities.FeePayment.create({
            academic_year: family.academic_year,
            invoice_id: inv.id,
            student_id,
            student_name: student.name,
            class_name: student.class_name,
            installment_name: inv.installment_name,
            receipt_no: `CREDIT-FAM${family_id.substring(0, 8)}-${Date.now()}`,
            amount_paid: -discountAmt, // negative = credit
            payment_date: new Date().toISOString().split('T')[0],
            payment_mode: 'Credit',
            reference_no: family_id, // stable family reference for reversal lookup
            remarks: `[SIBLING-FAMILY:${family_id}] ${family.family_name} sibling discount credit`,
            collected_by: user.email,
            status: 'Active'
          });
        }
        results.push({ student_id, status: 'applied_credit', credit_amount: discountAmt });
      } else {
        // Recalculate invoice if not fully paid
        if (inv) {
          const net = Math.max(gross - discountAmt, 0);
          const paidAmt = inv.paid_amount ?? 0;
          const balance = Math.max(net - paidAmt, 0);
          let status = inv.status;
          if (paidAmt >= net && net >= 0 && paidAmt > 0) status = 'Paid';
          else if (paidAmt > 0) status = 'Partial';
          else status = 'Pending';

          await base44.asServiceRole.entities.FeeInvoice.update(inv.id, {
            discount_total: discountAmt,
            total_amount: net,
            balance,
            status
          });
        }
        results.push({ student_id, status: 'applied' });
      }
    }

    await base44.asServiceRole.entities.FeeFamily.update(family_id, { sibling_discount_applied: true });
    return Response.json({ success: true, action: 'applied', results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});