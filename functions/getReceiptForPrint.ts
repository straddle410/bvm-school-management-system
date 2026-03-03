import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Role check: admin, principal, accountant
    const allowedRoles = ['admin', 'principal', 'accountant'];
    if (!user || !allowedRoles.includes((user.role || '').toLowerCase())) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse payment_id
    const body = await req.json().catch(() => ({}));
    const paymentId = body.payment_id;

    if (!paymentId) {
      return Response.json({ error: 'payment_id required' }, { status: 400 });
    }

    // Fetch payment
    const payment = await base44.entities.FeePayment.filter({ id: paymentId });
    if (!payment || payment.length === 0) {
      return Response.json({ error: 'Payment not found' }, { status: 404 });
    }
    const p = payment[0];

    // Fetch invoice
    const invoices = await base44.entities.FeeInvoice.filter({ id: p.invoice_id });
    const invoice = invoices?.[0];

    if (!invoice) {
      return Response.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Fetch student
    const students = await base44.entities.Student.filter({ student_id: p.student_id });
    const student = students?.[0];

    // Fetch school profile
    const profiles = await base44.entities.SchoolProfile.list();
    const school = profiles?.[0];

    // Calculate totals after this payment
    const allPayments = await base44.entities.FeePayment.filter({
      invoice_id: p.invoice_id,
      status: 'Active'
    }, 'payment_date');

    let totalPaidBeforeThis = 0;
    for (const pmt of allPayments) {
      if (pmt.id === paymentId) break;
      totalPaidBeforeThis += pmt.amount_paid || 0;
    }

    const totalPaidAfterThis = totalPaidBeforeThis + (p.amount_paid || 0);
    const balanceDueAfterThis = Math.max(0, (invoice.total_amount || 0) - totalPaidAfterThis);

    // Void info
    const voidInfo = p.status === 'VOID' ? {
      void_reason: p.void_reason || '',
      voided_at: p.voided_at || '',
      voided_by: p.voided_by || ''
    } : null;

    return Response.json({
      school: {
        name: school?.school_name || 'School Name',
        addressLine1: school?.address || '',
        phone: school?.phone || '',
        logoUrl: school?.logo_url || null
      },
      receipt: {
        receiptNo: p.receipt_no || 'N/A',
        dateTime: p.payment_date || new Date().toISOString().split('T')[0],
        academicYear: p.academic_year || '',
        student: {
          name: student?.name || p.student_name || '',
          admissionNo: student?.student_id || '',
          className: student?.class_name || invoice?.class_name || '',
          sectionName: student?.section || invoice?.section || 'A'
        },
        payment: {
          mode: p.payment_mode || 'Cash',
          amount: p.amount_paid || 0,
          referenceNo: p.reference_no || '',
          status: p.status || 'Active'
        },
        invoice: {
          gross: invoice?.gross_total || 0,
          discount: invoice?.discount_total || 0,
          net: invoice?.total_amount || 0,
          totalPaidAfterThis,
          balanceDueAfterThis
        },
        voidInfo
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});