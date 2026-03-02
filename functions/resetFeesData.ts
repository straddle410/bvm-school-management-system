import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { academicYear, className, section, confirmationToken } = await req.json();
    
    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    // Safety confirmation: must include exact token matching academic year
    const expectedToken = `RESET FEES ${academicYear}`;
    if (confirmationToken !== expectedToken) {
      return Response.json({ 
        error: `Invalid confirmation token. Expected: "${expectedToken}"`, 
        hint: 'Send exactly: confirmationToken: "RESET FEES YYYY-YY"'
      }, { status: 400 });
    }

    // Build filter
    const filter = { academic_year: academicYear };
    if (className) filter.class_name = className;
    if (section) filter.section = section;

    let counts = {
      fee_payments_deleted: 0,
      student_discounts_deleted: 0,
      fee_invoices_deleted: 0,
      families_cleaned: 0
    };

    // Step 1: Delete FeePayment entries (all types: CASH_PAYMENT, CREDIT_ADJUSTMENT, REVERSAL)
    const payments = await base44.asServiceRole.entities.FeePayment.filter(filter);
    for (const payment of payments) {
      await base44.asServiceRole.entities.FeePayment.delete(payment.id);
      counts.fee_payments_deleted++;
    }

    // Step 2: Delete StudentFeeDiscount entries (removes sibling discounts and manual discounts)
    const discounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter(filter);
    for (const discount of discounts) {
      await base44.asServiceRole.entities.StudentFeeDiscount.delete(discount.id);
      counts.student_discounts_deleted++;
    }

    // Step 3: Delete FeeInvoice entries (annual and adhoc)
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter(filter);
    for (const invoice of invoices) {
      await base44.asServiceRole.entities.FeeInvoice.delete(invoice.id);
      counts.fee_invoices_deleted++;
    }

    // Step 4: Clean up FeeFamily entries (set sibling_discount_applied = false)
    const families = await base44.asServiceRole.entities.FeeFamily.filter({ academic_year: academicYear });
    for (const family of families) {
      await base44.asServiceRole.entities.FeeFamily.update(family.id, {
        sibling_discount_applied: false
      });
      counts.families_cleaned++;
    }

    return Response.json({
      success: true,
      message: `Reset fees data for ${academicYear}${className ? ` Class ${className}` : ''}`,
      counts: counts,
      timestamp: new Date().toISOString(),
      reset_by: user.email
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});