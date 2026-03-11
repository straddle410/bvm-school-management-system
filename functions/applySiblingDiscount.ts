import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Try to get user context; allow service role for backend-to-backend calls
    let user = null;
    try {
      user = await base44.auth.me();
    } catch {
      // Backend-to-backend call: no user context
    }

    if (user) {
      const isAdmin = user.role === 'admin' || user.role === 'principal';
      if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { family_id, action } = await req.json(); // action = 'apply' | 'remove'
    if (!family_id) return Response.json({ error: 'family_id required' }, { status: 400 });
    if (!['apply', 'remove'].includes(action)) return Response.json({ error: 'action must be apply or remove' }, { status: 400 });

    const families = await base44.asServiceRole.entities.FeeFamily.filter({ id: family_id });
    const family = families[0];
    if (!family) return Response.json({ error: 'Family not found' }, { status: 404 });

    // ── ARCHIVE CHECK: Block mutations on archived years ──────────────────────
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ year: family.academic_year });
    if (academicYears && academicYears.length > 0) {
     const ayRecord = academicYears[0];
     if (ayRecord.status === 'Archived' || ayRecord.is_locked) {
       return Response.json({
         error: `Academic year ${family.academic_year} is archived; mutations not allowed`,
         status: 403
       }, { status: 403 });
     }
    }
    // ──────────────────────────────────────────────────────────────────────

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
          // Find CREDIT_ADJUSTMENT entries for this discount using reference_no (discount_application_id)
          const allPayments = await base44.asServiceRole.entities.FeePayment.filter({
            invoice_id: inv.id,
            student_id: d.student_id,
            academic_year: family.academic_year
          });
          
          const creditEntry = allPayments.find(p => 
            p.entry_type === 'CREDIT_ADJUSTMENT' && 
            p.amount_paid < 0 &&
            p.status === 'Active' &&
            p.reference_no === d.id // Match by discount_application_id
          );
          
          if (creditEntry) {
            // Check if reversal already exists (idempotency)
            const reversalExists = allPayments.some(p =>
              p.entry_type === 'REVERSAL' &&
              p.reference_no === creditEntry.reference_no &&
              p.status === 'Active'
            );
            
            if (!reversalExists) {
              // Create reversal entry (positive = reverses the negative credit)
              await base44.asServiceRole.entities.FeePayment.create({
                academic_year: family.academic_year,
                invoice_id: inv.id,
                student_id: d.student_id,
                student_name: creditEntry.student_name,
                class_name: creditEntry.class_name,
                installment_name: creditEntry.installment_name,
                receipt_no: `CREDIT-REV-${creditEntry.reference_no.substring(0, 8)}-${Date.now()}`,
                amount_paid: -creditEntry.amount_paid, // positive (reversal)
                payment_date: new Date().toISOString().split('T')[0],
                payment_mode: 'Credit',
                entry_type: 'REVERSAL',
                affects_cash: false,
                reference_no: creditEntry.reference_no, // same discount instance reference for tracking
                remarks: `[SIBLING-DISCOUNT-REV:${creditEntry.reference_no}] Family discount credit reversal`,
                collected_by: user?.email || user?.username || 'system',
                status: 'Active'
              });
            }
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
      return Response.json({ 
       success: true, 
       action: 'removed',
       affectedStudents: results.length,
       affectedInvoices: results.length,
       results 
      });
    }

    // APPLY - PROPORTIONAL DISTRIBUTION
    if (!family.sibling_discount_value || !family.sibling_discount_type) {
      return Response.json({ error: 'Family has no sibling discount configured' }, { status: 400 });
    }

    // Step 1: Fetch all students and their invoices to calculate total gross
    const familyStudents = [];
    const studentInvoices = {};
    let totalFamilyGross = 0;

    for (const student_id of (family.student_ids || [])) {
       // Global filter: status=Published, is_deleted=false (current AY implied by family)
       const students = await base44.asServiceRole.entities.Student.filter({ 
         student_id,
         status: 'Published',
         is_deleted: false,
         academic_year: family.academic_year
       });
       const student = students[0];
       if (!student) continue;

      const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
        student_id,
        academic_year: family.academic_year
      });
      const inv = invoices.find(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL');
      
      if (inv) {
        familyStudents.push(student);
        studentInvoices[student_id] = inv;
        const gross = inv.gross_total ?? inv.total_amount ?? 0;
        totalFamilyGross += gross;
      }
    }

    if (familyStudents.length === 0 || totalFamilyGross === 0) {
      return Response.json({ error: 'No valid invoices found for family students' }, { status: 400 });
    }

    // Step 2: Calculate proportional discount per student (rounded to nearest 500)
    const studentDiscountAmounts = {};
    let totalAllocated = 0;

    for (let i = 0; i < familyStudents.length; i++) {
      const student = familyStudents[i];
      const student_id = student.student_id;
      const inv = studentInvoices[student_id];
      const gross = inv.gross_total ?? inv.total_amount ?? 0;

      let discountAmt = 0;

      if (i === familyStudents.length - 1) {
        // Last student: absorb any rounding difference to ensure sum equals total
        discountAmt = family.sibling_discount_value - totalAllocated;
      } else {
        let raw = 0;

        if (family.sibling_discount_type === 'PERCENT') {
          // For percentage: apply % to each student's gross
          raw = (family.sibling_discount_value / 100) * gross;
        } else {
          // For AMOUNT: distribute proportionally
          const proportion = gross / totalFamilyGross;
          raw = family.sibling_discount_value * proportion;
        }

        // Round to nearest 500
        discountAmt = Math.round(raw / 500) * 500;
      }

      // Ensure discount doesn't exceed student's due amount
      const dueAmount = Math.max((inv.total_amount ?? inv.gross_total ?? 0) - (inv.paid_amount ?? 0), 0);
      discountAmt = Math.min(discountAmt, dueAmount);

      studentDiscountAmounts[student_id] = discountAmt;
      totalAllocated += discountAmt;
    }

    // Step 3: Apply discounts to each student
    const results = [];

    for (const student of familyStudents) {
      const student_id = student.student_id;
      const inv = studentInvoices[student_id];
      const discountAmt = studentDiscountAmounts[student_id];
      const isFullyPaid = inv && inv.status === 'Paid';

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

      // Create new sibling discount record (stored at proportional amount)
      const discountRecord = await base44.asServiceRole.entities.StudentFeeDiscount.create({
        academic_year: family.academic_year,
        student_id,
        student_name: student.name,
        class_name: student.class_name,
        discount_type: 'AMOUNT', // Always store as AMOUNT (the proportional value)
        discount_value: discountAmt, // Proportional discount for this student
        scope: family.sibling_discount_scope || 'TOTAL',
        fee_head_id: family.sibling_discount_fee_head_id || '',
        fee_head_name: family.sibling_discount_fee_head_name || '',
         notes: `[SIBLING] Family: ${family.family_name} (proportional)`,
        discount_source: 'FAMILY',
        family_id: family_id,
        status: 'Active',
        created_by: user?.email || user?.username || 'system'
      });
      
      const discount_application_id = discountRecord.id;

      // If fully paid, create ledger credit instead of applying to invoice
      if (isFullyPaid) {
        const existingCredits = await base44.asServiceRole.entities.FeePayment.filter({
          invoice_id: inv.id,
          student_id,
          academic_year: family.academic_year
        });
        const creditExists = existingCredits.some(p => 
          p.reference_no === discount_application_id && 
          p.amount_paid < 0 &&
          p.status === 'Active'
        );

        if (!creditExists) {
          await base44.asServiceRole.entities.FeePayment.create({
            academic_year: family.academic_year,
            invoice_id: inv.id,
            student_id,
            student_name: student.name,
            class_name: student.class_name,
            installment_name: inv.installment_name,
            receipt_no: `CREDIT-APP${discount_application_id.substring(0, 8)}-${Date.now()}`,
            amount_paid: -discountAmt,
            payment_date: new Date().toISOString().split('T')[0],
            payment_mode: 'Credit',
            entry_type: 'CREDIT_ADJUSTMENT',
            affects_cash: false,
            reference_no: discount_application_id,
            remarks: `[SIBLING-DISCOUNT:${discount_application_id}] ${family.family_name} proportional discount credit`,
            collected_by: user?.email || user?.username || 'system',
            status: 'Active'
          });
        }
        results.push({ student_id, status: 'applied_credit', discount_amount: discountAmt });
      } else {
        // Update invoice with proportional discount
        const gross = inv.gross_total ?? inv.total_amount ?? 0;
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
        results.push({ student_id, status: 'applied', discount_amount: discountAmt });
      }
    }

    await base44.asServiceRole.entities.FeeFamily.update(family_id, { sibling_discount_applied: true });
    // Calculate verification
    const perStudentBreakdown = results.map(r => ({
      student_id: r.student_id,
      discount_applied: r.discount_amount
    }));
    const verificationSum = results.reduce((sum, r) => sum + r.discount_amount, 0);

    return Response.json({ 
      success: true, 
      action: 'applied',
      affectedStudents: results.length,
      affectedInvoices: results.length,
      totalFamilyDiscount: family.sibling_discount_type === 'PERCENT' 
        ? `${family.sibling_discount_value}% (calculated as ₹${totalAllocated})` 
        : family.sibling_discount_value,
      totalDiscountApplied: totalAllocated,
      perStudentBreakdown,
      verificationSumEqualsTotal: verificationSum === totalAllocated,
      results 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});