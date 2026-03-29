import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, academic_year, asOfDate } = await req.json();

    if (!student_id || !academic_year) {
      return Response.json({ error: 'student_id and academic_year required' }, { status: 400 });
    }

    // Verify user is authenticated
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch invoices and payments (using user-scoped access)
    const invoices = await base44.entities.FeeInvoice.filter({
      student_id,
      academic_year
    });

    const payments = await base44.entities.FeePayment.filter({
      student_id,
      academic_year
    });

    // Filter active payments only
    const activePayments = payments.filter(p => p.status === 'Active');

    // Format invoices
    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      installment: inv.installment_name,
      dueDate: inv.due_date,
      gross: inv.gross_total || 0,
      discount: inv.discount_total || 0,
      net: inv.total_amount || 0,
      status: inv.status
    }));

    // Format payments
    const formattedPayments = activePayments.map(p => ({
      id: p.id,
      date: p.payment_date,
      receiptNo: p.receipt_no,
      entryType: p.entry_type || 'CASH_PAYMENT',
      mode: p.payment_mode,
      amount: p.amount_paid
    }));

    // Calculate totals
    const netInvoiced = formattedInvoices.reduce((sum, inv) => sum + inv.net, 0);
    const totalPaid = formattedPayments.reduce((sum, p) => sum + p.amount, 0);

    return Response.json({
      invoices: formattedInvoices,
      payments: formattedPayments,
      netInvoiced,
      totalPaid,
      paidAmount: totalPaid
    });
  } catch (error) {
    console.error('getStudentOutstandingDetail error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});