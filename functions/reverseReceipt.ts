import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user.role?.toLowerCase();
    const isAdmin = ['admin', 'principal'].includes(userRole);

    // Non-admins need the fees_reverse_receipt permission
    if (!isAdmin) {
      // Look up StaffAccount to check granular permission
      const staffAccounts = await base44.asServiceRole.entities.StaffAccount.filter({ email: user.email });
      const staffAccount = staffAccounts?.[0];
      const hasPermission = staffAccount?.permissions?.fees_reverse_receipt === true;
      if (!hasPermission) {
        return Response.json({ error: 'Forbidden: You do not have permission to reverse receipts' }, { status: 403 });
      }
    }

    const { paymentId, reason } = await req.json();
    if (!paymentId) return Response.json({ error: 'paymentId is required' }, { status: 400 });
    if (!reason?.trim()) return Response.json({ error: 'Reversal reason is required' }, { status: 400 });

    // Fetch the payment
    const payment = await base44.asServiceRole.entities.FeePayment.get(paymentId);
    if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });
    if (payment.status === 'REVERSED') return Response.json({ error: 'Payment is already reversed' }, { status: 400 });

    // Non-admins can only reverse same-day receipts
    if (!isAdmin) {
      const today = new Date().toISOString().split('T')[0];
      if (payment.payment_date !== today) {
        return Response.json({ error: 'Non-admin users can only reverse receipts created today. Please contact an admin for older receipts.' }, { status: 403 });
      }
    }

    // Fetch the invoice
    const invoice = await base44.asServiceRole.entities.FeeInvoice.get(payment.invoice_id);
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    const reversalTimestamp = new Date().toISOString();
    const reversalDate = reversalTimestamp.split('T')[0];

    // Mark original payment as REVERSED
    await base44.asServiceRole.entities.FeePayment.update(paymentId, {
      status: 'REVERSED',
      reversal_reason: reason,
      reversed_by: user.email,
      reversed_at: reversalTimestamp
    });

    // Create a REVERSAL entry so it shows up in Day Book / Collection Report
    // This is the authoritative debit event in the cash ledger
    const reversalReceiptNo = `REV/${payment.receipt_no || payment.id.slice(-6).toUpperCase()}`;
    await base44.asServiceRole.entities.FeePayment.create({
      academic_year: payment.academic_year,
      invoice_id: payment.invoice_id,
      student_id: payment.student_id,
      student_name: payment.student_name,
      class_name: payment.class_name,
      installment_name: payment.installment_name,
      receipt_no: reversalReceiptNo,
      amount_paid: -(Math.abs(payment.amount_paid || 0)), // negative — debit back
      payment_date: reversalDate,
      payment_mode: payment.payment_mode || 'Cash',
      entry_type: 'REVERSAL',
      affects_cash: true,
      status: 'Active',
      // Audit trail linkage
      reference_no: payment.receipt_no || payment.id,
      original_payment_id: paymentId,
      original_receipt_no: payment.receipt_no || null,
      reversal_receipt_no: reversalReceiptNo,
      reversed_at: reversalTimestamp,
      remarks: `Reversal of ${payment.receipt_no || paymentId}. Reason: ${reason}`,
      collected_by: user.email,
      reversed_by: user.email,
      reversal_reason: reason
    });

    // Recalculate invoice paid_amount from all non-reversed payments
    const allPayments = await base44.asServiceRole.entities.FeePayment.filter({ invoice_id: payment.invoice_id });
    const totalPaid = allPayments
      .filter(p => p.id !== paymentId && p.status !== 'REVERSED')
      .reduce((sum, p) => sum + (p.amount_paid || 0), 0);

    const netAmount = invoice.total_amount || 0;
    const balance = Math.max(netAmount - totalPaid, 0);

    let newStatus = invoice.status;
    if (totalPaid <= 0) newStatus = 'Pending';
    else if (balance <= 0) newStatus = 'Paid';
    else newStatus = 'Partial';

    await base44.asServiceRole.entities.FeeInvoice.update(payment.invoice_id, {
      paid_amount: totalPaid,
      balance: balance,
      status: newStatus
    });

    return Response.json({ success: true, new_paid_amount: totalPaid, new_balance: balance, new_status: newStatus });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});