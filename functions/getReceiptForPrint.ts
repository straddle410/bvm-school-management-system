import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  let paymentId = null;
  let step = 'init';
  
  try {
    const base44 = createClientFromRequest(req);
    step = 'auth';
    const user = await base44.auth.me();

    // Role check: admin, principal, accountant
    const allowedRoles = ['admin', 'principal', 'accountant'];
    if (!user || !allowedRoles.includes((user.role || '').toLowerCase())) {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Parse payment_id
    const body = await req.json().catch(() => ({}));
    paymentId = body.payment_id;

    if (!paymentId) {
      return Response.json({ error: 'payment_id required' }, { status: 400 });
    }

    // Fetch payment (use asServiceRole to avoid user permission restrictions)
    step = 'fetch_payment';
    const payment = await base44.asServiceRole.entities.FeePayment.filter({ id: paymentId });
    if (!payment || payment.length === 0) {
      return Response.json({ error: 'Payment not found for id: ' + paymentId }, { status: 404 });
    }
    const p = payment[0];

    // Fetch all in parallel (use asServiceRole for all)
    step = 'fetch_parallel';
    const [invoices, students, profiles, allPayments] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ id: p.invoice_id }).catch(() => []),
      base44.asServiceRole.entities.Student.filter({ student_id: p.student_id }).catch(() => []),
      base44.asServiceRole.entities.SchoolProfile.list().catch(() => []),
      base44.asServiceRole.entities.FeePayment.filter({ invoice_id: p.invoice_id, status: 'Active' }, 'payment_date').catch(() => [])
    ]);

    const invoice = invoices?.[0];
    const student = students?.[0];
    const school = profiles?.[0];

    // If critical data missing, still return with defaults
    step = 'calculate_totals';
    let totalPaidBeforeThis = 0;
    if (allPayments && allPayments.length > 0) {
      for (const pmt of allPayments) {
        if (pmt.id === paymentId) break;
        totalPaidBeforeThis += pmt.amount_paid || 0;
      }
    }

    const totalPaidAfterThis = totalPaidBeforeThis + (p.amount_paid || 0);
    const balanceDueAfterThis = Math.max(0, (invoice?.total_amount || 0) - totalPaidAfterThis);

    // Void info (use denormalized names only, no user lookups)
    step = 'void_info';
    const voidInfo = (p.status === 'VOID' || p.status === 'void') ? {
      void_reason: p.void_reason || p.reversal_reason || '',
      voided_at: p.voided_at || p.reversed_at || '',
      voided_by_name: p.voided_by_name || '—'
    } : null;

    step = 'response';
    return Response.json({
      success: true,
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
          status: p.status || 'Active',
          collectedByName: p.collected_by_name || '—'
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
    console.error(`getReceiptForPrint error at step: ${step}`, error);
    return Response.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: error.stack || '',
      context: { payment_id: paymentId, step }
    }, { status: 500 });
  }
});