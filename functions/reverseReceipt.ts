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

    // Fetch the invoice
    const invoice = await base44.asServiceRole.entities.FeeInvoice.get(payment.invoice_id);
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    // Mark original payment as REVERSED
    await base44.asServiceRole.entities.FeePayment.update(paymentId, {
      status: 'REVERSED',
      reversal_reason: reason,
      reversed_by: user.email,
      reversed_at: new Date().toISOString()
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