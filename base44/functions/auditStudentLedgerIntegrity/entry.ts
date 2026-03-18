import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { academicYear = '2025-26' } = body;

    // Fetch all invoices, payments, and students
    const [invoices, payments, students] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.Student.filter({ academic_year: academicYear })
    ]);

    const issues = [];
    const stats = {
      total_invoices: invoices.length,
      total_payments: payments.length,
      total_students: students.length,
      invoices_with_errors: 0,
      payments_with_errors: 0,
      balance_mismatches: [],
      missing_invoices: [],
      orphan_payments: [],
      negative_balances: [],
      calculation_errors: [],
      void_payment_issues: []
    };

    const studentMap = Object.fromEntries(students.map(s => [s.student_id, s]));
    const invoiceMap = Object.fromEntries(invoices.map(inv => [inv.id, inv]));
    const paymentsByInvoice = {};

    // Group payments by invoice
    payments.forEach(p => {
      if (!paymentsByInvoice[p.invoice_id]) {
        paymentsByInvoice[p.invoice_id] = [];
      }
      paymentsByInvoice[p.invoice_id].push(p);
    });

    // Verify each invoice
    invoices.forEach(invoice => {
      const invoiceIssues = [];

      // 1. Check if student exists
      if (!studentMap[invoice.student_id]) {
        stats.missing_invoices.push({
          invoice_id: invoice.id,
          student_id: invoice.student_id,
          reason: 'Student not found'
        });
        return;
      }

      // 2. Check fee_heads structure
      if (!invoice.fee_heads || !Array.isArray(invoice.fee_heads)) {
        invoiceIssues.push('fee_heads is missing or not an array');
      } else {
        invoice.fee_heads.forEach(fh => {
          if (!fh.fee_head_name || typeof fh.gross_amount !== 'number') {
            invoiceIssues.push(`Invalid fee_head: ${fh.fee_head_name}`);
          }
        });
      }

      // 3. Verify gross_total calculation
      const calculatedGross = (invoice.fee_heads || []).reduce((sum, fh) => sum + (fh.gross_amount || 0), 0);
      if (Math.abs(calculatedGross - (invoice.gross_total || 0)) > 0.01) {
        invoiceIssues.push(`gross_total mismatch: calculated=${calculatedGross}, stored=${invoice.gross_total}`);
      }

      // 4. Verify total_amount (net) calculation
      const expectedNet = Math.max((invoice.gross_total || 0) - (invoice.discount_total || 0), 0);
      if (Math.abs(expectedNet - (invoice.total_amount || 0)) > 0.01) {
        invoiceIssues.push(`total_amount mismatch: expected=${expectedNet}, stored=${invoice.total_amount}`);
      }

      // 5. Verify balance calculation
      const invoicePayments = paymentsByInvoice[invoice.id] || [];
      const totalPaid = invoicePayments
        .filter(p => p.status !== 'VOID')
        .reduce((sum, p) => sum + (p.amount_paid || 0), 0);

      const expectedBalance = Math.max((invoice.total_amount || 0) - totalPaid, 0);
      if (Math.abs(expectedBalance - (invoice.balance || 0)) > 0.01) {
        stats.balance_mismatches.push({
          invoice_id: invoice.id,
          student_id: invoice.student_id,
          expected_balance: expectedBalance,
          stored_balance: invoice.balance,
          total_amount: invoice.total_amount,
          total_paid: totalPaid
        });
      }

      // 6. Check for negative balance
      if ((invoice.balance || 0) < 0) {
        stats.negative_balances.push({
          invoice_id: invoice.id,
          student_id: invoice.student_id,
          balance: invoice.balance
        });
      }

      if (invoiceIssues.length > 0) {
        stats.invoices_with_errors++;
        stats.calculation_errors.push({
          invoice_id: invoice.id,
          student_id: invoice.student_id,
          errors: invoiceIssues
        });
      }
    });

    // Verify each payment
    payments.forEach(payment => {
      const paymentIssues = [];

      // 1. Check if invoice exists
      if (!invoiceMap[payment.invoice_id]) {
        stats.orphan_payments.push({
          payment_id: payment.id,
          invoice_id: payment.invoice_id,
          reason: 'Invoice not found'
        });
        return;
      }

      // 2. Check for VOID status inconsistencies
      if (payment.status === 'VOID' && !payment.voided_by) {
        paymentIssues.push('Payment is VOID but voided_by is not set');
      }

      if (payment.status !== 'VOID' && payment.voided_by) {
        paymentIssues.push('Payment is Active but has voided_by set');
      }

      // 3. Check receipt_no uniqueness (sample check)
      if (!payment.receipt_no) {
        paymentIssues.push('receipt_no is missing');
      }

      if (paymentIssues.length > 0) {
        stats.payments_with_errors++;
        stats.void_payment_issues.push({
          payment_id: payment.id,
          invoice_id: payment.invoice_id,
          student_id: payment.student_id,
          errors: paymentIssues
        });
      }
    });

    const totalIssues =
      stats.balance_mismatches.length +
      stats.missing_invoices.length +
      stats.orphan_payments.length +
      stats.negative_balances.length +
      stats.calculation_errors.length +
      stats.void_payment_issues.length;

    return Response.json({
      success: true,
      academicYear,
      timestamp: new Date().toISOString(),
      stats: {
        ...stats,
        total_issues: totalIssues,
        is_healthy: totalIssues === 0
      },
      issues: {
        balance_mismatches: stats.balance_mismatches,
        missing_invoices: stats.missing_invoices,
        orphan_payments: stats.orphan_payments,
        negative_balances: stats.negative_balances,
        calculation_errors: stats.calculation_errors,
        void_payment_issues: stats.void_payment_issues
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});