import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invoiceId, amountPaid, paymentDate, paymentMode, referenceNo, remarks } = await req.json();

    if (!invoiceId || !amountPaid || !paymentDate) {
      return Response.json({ error: 'invoiceId, amountPaid and paymentDate are required' }, { status: 400 });
    }

    // Load invoice
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({ id: invoiceId });
    if (!invoices || invoices.length === 0) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }
    const invoice = invoices[0];

    // Load student to validate academic_year integrity
    const students = await base44.asServiceRole.entities.Student.filter({ student_id: invoice.student_id });
    if (students && students.length > 0) {
      const student = students[0];
      if (student.academic_year && student.academic_year !== invoice.academic_year) {
        return Response.json({
          error: `Academic year mismatch: student is in ${student.academic_year} but invoice belongs to ${invoice.academic_year}`
        }, { status: 422 });
      }
    }

    if (invoice.status === 'Paid' || invoice.status === 'Waived') {
      return Response.json({ error: `Invoice is already ${invoice.status}` }, { status: 409 });
    }

    // Generate receipt number
    const timestamp = Date.now();
    const receiptNo = `RCP-${invoice.academic_year?.replace('-', '')}-${timestamp.toString().slice(-6)}`;

    // Create payment record
    const payment = await base44.asServiceRole.entities.FeePayment.create({
      academic_year: invoice.academic_year,
      invoice_id: invoice.id,
      student_id: invoice.student_id,
      student_name: invoice.student_name,
      class_name: invoice.class_name,
      installment_name: invoice.installment_name,
      receipt_no: receiptNo,
      amount_paid: amountPaid,
      payment_date: paymentDate,
      payment_mode: paymentMode || 'Cash',
      reference_no: referenceNo || '',
      remarks: remarks || '',
      collected_by: user.email
    });

    // Update invoice paid_amount and status
    const newPaid = (invoice.paid_amount || 0) + amountPaid;
    const newBalance = invoice.total_amount - newPaid;
    let newStatus = 'Partial';
    if (newBalance <= 0) newStatus = 'Paid';
    else if (newPaid === 0) newStatus = 'Pending';

    await base44.asServiceRole.entities.FeeInvoice.update(invoice.id, {
      paid_amount: newPaid,
      balance: Math.max(0, newBalance),
      status: newStatus
    });

    return Response.json({ success: true, receipt_no: receiptNo, payment_id: payment.id, new_status: newStatus, balance: Math.max(0, newBalance) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});