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

    // If class filter provided, get student IDs first
    let studentIds = null;
    if (className) {
      const students = await base44.asServiceRole.entities.Student.filter({
        class_name: className,
        section: section || 'A',
        academic_year: academicYear
      });
      studentIds = students.map(s => s.student_id);
    }

    // Base filter
    const baseFilter = { academic_year: academicYear };
    
    let counts = {
      fee_payments_deleted: 0,
      fee_receipts_deleted: 0,
      fee_transactions_deleted: 0,
      student_discounts_deleted: 0,
      fee_invoices_deleted: 0,
      families_cleaned: 0
    };

    // Step 1: Delete FeePayment entries
    let paymentFilter = { ...baseFilter };
    if (studentIds) {
      paymentFilter = { academic_year: academicYear };
      const allPayments = await base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear });
      const filteredPayments = allPayments.filter(p => studentIds.includes(p.student_id));
      for (const payment of filteredPayments) {
        await base44.asServiceRole.entities.FeePayment.delete(payment.id);
        counts.fee_payments_deleted++;
      }
    } else {
      const payments = await base44.asServiceRole.entities.FeePayment.filter(paymentFilter);
      for (const payment of payments) {
        await base44.asServiceRole.entities.FeePayment.delete(payment.id);
        counts.fee_payments_deleted++;
      }
    }

    // Step 2: Delete FeeReceipt entries if entity exists (for Payment History UI)
    try {
      let receiptFilter = { ...baseFilter };
      if (studentIds) {
        const allReceipts = await base44.asServiceRole.entities.FeeReceipt.filter({ academic_year: academicYear });
        const filteredReceipts = allReceipts.filter(r => studentIds.includes(r.student_id));
        for (const receipt of filteredReceipts) {
          await base44.asServiceRole.entities.FeeReceipt.delete(receipt.id);
          counts.fee_receipts_deleted++;
        }
      } else {
        const receipts = await base44.asServiceRole.entities.FeeReceipt.filter(receiptFilter);
        for (const receipt of receipts) {
          await base44.asServiceRole.entities.FeeReceipt.delete(receipt.id);
          counts.fee_receipts_deleted++;
        }
      }
    } catch {
      // FeeReceipt entity may not exist
    }

    // Step 3: Delete FeeTransaction entries if entity exists (for Dashboard)
    try {
      let txnFilter = { ...baseFilter };
      if (studentIds) {
        const allTxns = await base44.asServiceRole.entities.FeeTransaction.filter({ academic_year: academicYear });
        const filteredTxns = allTxns.filter(t => studentIds.includes(t.student_id));
        for (const txn of filteredTxns) {
          await base44.asServiceRole.entities.FeeTransaction.delete(txn.id);
          counts.fee_transactions_deleted++;
        }
      } else {
        const txns = await base44.asServiceRole.entities.FeeTransaction.filter(txnFilter);
        for (const txn of txns) {
          await base44.asServiceRole.entities.FeeTransaction.delete(txn.id);
          counts.fee_transactions_deleted++;
        }
      }
    } catch {
      // FeeTransaction entity may not exist
    }

    // Step 4: Delete StudentFeeDiscount entries
    let discountFilter = { ...baseFilter };
    if (studentIds) {
      const allDiscounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter({ academic_year: academicYear });
      const filteredDiscounts = allDiscounts.filter(d => studentIds.includes(d.student_id));
      for (const discount of filteredDiscounts) {
        await base44.asServiceRole.entities.StudentFeeDiscount.delete(discount.id);
        counts.student_discounts_deleted++;
      }
    } else {
      const discounts = await base44.asServiceRole.entities.StudentFeeDiscount.filter(discountFilter);
      for (const discount of discounts) {
        await base44.asServiceRole.entities.StudentFeeDiscount.delete(discount.id);
        counts.student_discounts_deleted++;
      }
    }

    // Step 5: Delete FeeInvoice entries
    let invoiceFilter = { ...baseFilter };
    if (studentIds) {
      const allInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear });
      const filteredInvoices = allInvoices.filter(inv => studentIds.includes(inv.student_id));
      for (const invoice of filteredInvoices) {
        await base44.asServiceRole.entities.FeeInvoice.delete(invoice.id);
        counts.fee_invoices_deleted++;
      }
    } else {
      const invoices = await base44.asServiceRole.entities.FeeInvoice.filter(invoiceFilter);
      for (const invoice of invoices) {
        await base44.asServiceRole.entities.FeeInvoice.delete(invoice.id);
        counts.fee_invoices_deleted++;
      }
    }

    // Step 6: Clean up FeeFamily entries
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