import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// VOID-ONLY POLICY:
// Voiding a receipt marks it VOID. No negative/child entries are created.
// A VOID receipt has zero financial effect on all reports.

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
      const staffAccounts = await base44.asServiceRole.entities.StaffAccount.filter({ email: user.email });
      const staffAccount = staffAccounts?.[0];
      const hasPermission = staffAccount?.permissions?.fees_reverse_receipt === true;
      if (!hasPermission) {
        return Response.json({ error: 'Forbidden: You do not have permission to void receipts' }, { status: 403 });
      }
    }

    const { paymentId, reason } = await req.json();
    if (!paymentId) return Response.json({ error: 'paymentId is required' }, { status: 400 });
    if (!reason?.trim()) return Response.json({ error: 'Void reason is required' }, { status: 400 });

    // Fetch the payment
    const payment = await base44.asServiceRole.entities.FeePayment.get(paymentId);
    if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });

    // IDEMPOTENT: already voided → return success with no changes
    if (payment.status === 'VOID') {
      return Response.json({
        success: true,
        already_voided: true,
        message: 'Receipt was already voided — no changes made.'
      });
    }

    // Non-admins can only void same-day receipts
    if (!isAdmin) {
      const today = new Date().toISOString().split('T')[0];
      if (payment.payment_date !== today) {
        return Response.json({
          error: 'Non-admin users can only void receipts created today. Please contact an admin for older receipts.'
        }, { status: 403 });
      }
    }

    // Fetch the invoice
    const invoice = await base44.asServiceRole.entities.FeeInvoice.get(payment.invoice_id);
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    // ── VOID the payment (no child/negative entry created) ─────────────────
    await base44.asServiceRole.entities.FeePayment.update(paymentId, {
      status: 'VOID',
      void_reason: reason,
      voided_by: user.email,
      voided_at: new Date().toISOString()
    });

    // ── Recalculate invoice: exclude ALL voided payments ──────────────────
    const allPayments = await base44.asServiceRole.entities.FeePayment.filter({ invoice_id: payment.invoice_id });
    const totalPaid = allPayments
      .filter(p => p.id !== paymentId && p.status !== 'VOID')
      .reduce((sum, p) => sum + (p.amount_paid || 0), 0);

    const netAmount = invoice.total_amount || 0;
    const balance = Math.max(netAmount - totalPaid, 0);

    let newStatus;
    if (totalPaid <= 0) newStatus = 'Pending';
    else if (balance <= 0) newStatus = 'Paid';
    else newStatus = 'Partial';

    await base44.asServiceRole.entities.FeeInvoice.update(payment.invoice_id, {
      paid_amount: totalPaid,
      balance: balance,
      status: newStatus
    });

    return Response.json({
      success: true,
      already_voided: false,
      new_paid_amount: totalPaid,
      new_balance: balance,
      new_status: newStatus
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});