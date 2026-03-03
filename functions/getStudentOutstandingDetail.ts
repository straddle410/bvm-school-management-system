import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['admin', 'principal'].includes(user.role?.toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { studentId, academicYear, asOfDate } = await req.json().catch(() => ({}));
    if (!studentId || !academicYear) {
      return Response.json({ error: 'studentId and academicYear required' }, { status: 400 });
    }

    const cutoff = asOfDate || new Date().toISOString().split('T')[0];

    const [invoices, payments] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear, student_id: studentId }),
      base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear, student_id: studentId })
    ]);

    const activeInvoices = invoices.filter(inv => {
      if (inv.status === 'Cancelled') return false;
      const d = inv.due_date || inv.created_date;
      if (d && d > cutoff) return false;
      return true;
    });

    const activePayments = payments.filter(p => {
      if (p.status === 'REVERSED') return false;
      const d = p.payment_date || p.created_date;
      if (d && d > cutoff) return false;
      return true;
    });

    const invoiceRows = activeInvoices.map(inv => ({
      id: inv.id,
      installment: inv.installment_name || inv.title || 'Invoice',
      dueDate: inv.due_date,
      gross: inv.gross_total ?? inv.total_amount ?? 0,
      discount: inv.discount_total ?? 0,
      net: inv.total_amount ?? 0,
      paid: inv.paid_amount ?? 0,
      status: inv.status,
      type: inv.invoice_type
    }));

    const paymentRows = activePayments.map(p => {
      let amount = p.amount_paid || 0;
      if (p.entry_type === 'REVERSAL' && amount > 0) amount = -amount;
      return {
        id: p.id,
        receiptNo: p.receipt_no,
        date: p.payment_date,
        mode: p.payment_mode,
        amount,
        entryType: p.entry_type,
        remarks: p.remarks
      };
    });

    const netInvoiced = invoiceRows.reduce((s, r) => s + r.net, 0);
    const totalPaid = paymentRows.reduce((s, r) => s + r.amount, 0);
    const outstanding = Math.max(netInvoiced - totalPaid, 0);

    return Response.json({ invoices: invoiceRows, payments: paymentRows, netInvoiced, totalPaid, outstanding });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});