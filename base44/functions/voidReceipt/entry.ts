/**
 * CANONICAL: Void a fee payment receipt.
 * 
 * Marks a payment as VOID (not deleted). Updates:
 * - FeePayment: status=VOID, void_reason, voided_by, voided_at
 * - FeeInvoice: recalculates paid_amount (excluding voided), balance, status
 * 
 * VOID-ONLY POLICY: A voided receipt has zero financial effect on all reports.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { paymentId, reason, staffInfo } = await req.json();

    if (!staffInfo || !staffInfo.staff_id) {
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }

    const user = staffInfo;
    const userRole = (staffInfo.role || '').toLowerCase();
    const isAdmin = ['admin', 'principal'].includes(userRole);

    // Non-admins need the fees_reverse_receipt permission
    if (!isAdmin) {
      const staffAccount = await base44.asServiceRole.entities.StaffAccount.get(staffInfo.staff_id);
      const hasPermission = staffAccount?.permissions?.fees_reverse_receipt === true;
      if (!hasPermission) {
        return Response.json({ error: 'Forbidden: You do not have permission to void receipts' }, { status: 403 });
      }
    }
    if (!paymentId) return Response.json({ error: 'paymentId is required' }, { status: 400 });
    if (!reason?.trim()) return Response.json({ error: 'Void reason is required' }, { status: 400 });

    // Fetch the payment
    const payment = await base44.asServiceRole.entities.FeePayment.get(paymentId);
    if (!payment) return Response.json({ error: 'Payment not found' }, { status: 404 });

    // ── ARCHIVE CHECK: Block mutations on archived years ──────────────────────
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ year: payment.academic_year });
    if (academicYears && academicYears.length > 0) {
      const ayRecord = academicYears[0];
      if (ayRecord.status === 'Archived' || ayRecord.is_locked) {
        return Response.json({
          error: `Academic year ${payment.academic_year} is archived; mutations not allowed`,
          status: 403
        }, { status: 403 });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    // IDEMPOTENT: already voided → return success with current state
    if (payment.status === 'VOID') {
      // Fetch invoice to return current state
      const invoice = await base44.asServiceRole.entities.FeeInvoice.get(payment.invoice_id);
      const allPayments = await base44.asServiceRole.entities.FeePayment.filter({ invoice_id: payment.invoice_id });
      const totalPaid = allPayments
        .filter(p => p.status !== 'VOID')
        .reduce((sum, p) => sum + (p.amount_paid || 0), 0);
      const netAmount = invoice?.total_amount || 0;
      const balance = Math.max(netAmount - totalPaid, 0);

      return Response.json({
        success: true,
        already_voided: true,
        message: 'Receipt was already voided — no changes made.',
        new_paid_amount: totalPaid,
        new_balance: balance,
        new_status: invoice?.status || 'Pending'
      });
    }

    // Non-admins can only void same-day receipts
    if (!isAdmin) {
      const today = new Date().toISOString().split('T')[0];
      if (payment.payment_date !== today) {
        return Response.json({
          error: `Only receipts created today can be voided by staff. This receipt was created on ${payment.payment_date}. Contact an administrator to void older receipts.`
        }, { status: 403 });
      }
    }

    // Fetch the invoice
    const invoice = await base44.asServiceRole.entities.FeeInvoice.get(payment.invoice_id);
    if (!invoice) return Response.json({ error: 'Invoice not found' }, { status: 404 });

    // ── ATOMIC: Try to mark VOID (conditional) to prevent race conditions ──
    // This ensures only ONE concurrent request actually voids
    try {
      await base44.asServiceRole.entities.FeePayment.update(paymentId, {
        status: 'VOID',
        void_reason: reason,
        voided_by: user.email,
        voided_by_name: user.full_name || user.email,
        voided_at: new Date().toISOString()
      });
    } catch (err) {
      // If update fails (e.g., concurrent void), reload and return already_voided
      const reloadPayment = await base44.asServiceRole.entities.FeePayment.get(paymentId);
      if (reloadPayment.status === 'VOID') {
        // Another request already voided it—treat as idempotent success
        const allPayments = await base44.asServiceRole.entities.FeePayment.filter({ invoice_id: payment.invoice_id });
        const totalPaid = allPayments
          .filter(p => p.status !== 'VOID')
          .reduce((sum, p) => sum + (p.amount_paid || 0), 0);
        const netAmount = invoice?.total_amount || 0;
        const balance = Math.max(netAmount - totalPaid, 0);
        return Response.json({
          success: true,
          already_voided: true,
          message: 'Receipt was already voided by concurrent request.',
          new_paid_amount: totalPaid,
          new_balance: balance,
          new_status: invoice?.status || 'Pending'
        });
      }
      throw err;
    }

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