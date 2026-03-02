import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const role = (user.role || '').toLowerCase();
    if (role !== 'admin' && role !== 'principal') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { studentId, academicYear } = await req.json();
    if (!studentId || !academicYear) {
      return Response.json({ error: 'studentId and academicYear required' }, { status: 400 });
    }

    // Find all invoices for this student/year
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      student_id: studentId,
      academic_year: academicYear,
      installment_name: 'Annual Fee'
    });

    if (!invoices || invoices.length === 0) {
      return Response.json({ error: 'No invoices found for this student' }, { status: 404 });
    }

    // Find the active invoice (or Pending/Partial)
    let activeInvoice = invoices.find(inv => ['Pending', 'Partial', 'Paid'].includes(inv.status));
    
    // If no active, restore the oldest one
    if (!activeInvoice) {
      activeInvoice = invoices.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
      await base44.asServiceRole.entities.FeeInvoice.update(activeInvoice.id, { status: 'Pending' });
    }

    // Find all payments for this student
    const payments = await base44.asServiceRole.entities.FeePayment.filter({
      student_id: studentId,
      academic_year: academicYear,
      entry_type: 'CASH_PAYMENT'
    });

    // Re-link all payments to the active invoice
    let relinked = 0;
    for (const payment of payments) {
      if (payment.invoice_id !== activeInvoice.id) {
        await base44.asServiceRole.entities.FeePayment.update(payment.id, {
          invoice_id: activeInvoice.id
        });
        relinked++;
      }
    }

    // Recalculate invoice paid_amount and status
    const totalPaid = payments.reduce((sum, p) => sum + (p.status === 'Active' && p.entry_type === 'CASH_PAYMENT' ? (p.amount_paid || 0) : 0), 0);
    const newBalance = Math.max((activeInvoice.total_amount || 0) - totalPaid, 0);
    let newStatus = 'Pending';
    if (totalPaid > 0) newStatus = newBalance > 0 ? 'Partial' : 'Paid';

    await base44.asServiceRole.entities.FeeInvoice.update(activeInvoice.id, {
      paid_amount: totalPaid,
      balance: newBalance,
      status: newStatus
    });

    // Archive cancelled invoices
    let archived = 0;
    for (const inv of invoices) {
      if (inv.id !== activeInvoice.id && inv.status === 'Cancelled') {
        // Check if any payments link to it
        const linkedPayments = payments.filter(p => p.invoice_id === inv.id);
        if (linkedPayments.length === 0) {
          // Safe to keep as Cancelled
        }
      }
    }

    return Response.json({
      success: true,
      message: `Restored payment link. Active invoice: ${activeInvoice.id}, Re-linked ${relinked} payment(s)`,
      active_invoice_id: activeInvoice.id,
      new_paid_amount: totalPaid,
      new_balance: newBalance,
      new_status: newStatus,
      relinked: relinked
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});