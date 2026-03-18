import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  let paymentId = null;
  let step = 'init';
  
  try {
    const base44 = createClientFromRequest(req);
    
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
      base44.asServiceRole.entities.FeePayment.filter({ invoice_id: p.invoice_id }).catch(() => [])
    ]);

    const invoice = invoices?.[0];
    const student = students?.[0];
    const school = profiles?.[0];

    // Calculate totals from frozen snapshot (NEVER changes after receipt creation)
    step = 'calculate_totals';

    // Use receipt_snapshot if available (frozen at payment time)
    // Fallback to invoice state for legacy receipts without snapshot
    let grossTotal = 0;
    let discountTotal = 0;
    let netTotal = 0;
    let totalPaidBeforeThis = 0;
    let totalPaidAfterThis = 0;
    let balanceDueAfterThis = 0;

    if (p.receipt_snapshot) {
      // Use frozen snapshot — guarantees receipt never changes
      grossTotal = p.receipt_snapshot.invoice_gross_total || 0;
      discountTotal = p.receipt_snapshot.invoice_discount_total || 0;
      netTotal = p.receipt_snapshot.invoice_net_total || 0;
      totalPaidBeforeThis = p.receipt_snapshot.total_paid_before || 0;
      balanceDueAfterThis = p.receipt_snapshot.balance_before - p.amount_paid;
      totalPaidAfterThis = totalPaidBeforeThis + p.amount_paid;
    } else {
      // Legacy fallback: use current invoice state
      grossTotal = invoice?.gross_total || 0;
      discountTotal = invoice?.discount_total || 0;
      netTotal = invoice?.total_amount || 0;
      
      if (p.status === 'VOID' || p.status === 'void') {
        totalPaidAfterThis = allPayments
          .filter(pmt => pmt.status === 'Active')
          .reduce((sum, pmt) => sum + (pmt.amount_paid || 0), 0);
      } else {
        totalPaidAfterThis = invoice?.paid_amount || 0;
      }
      balanceDueAfterThis = Math.max(0, netTotal - totalPaidAfterThis);
    }

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
          gross: grossTotal,
          discount: discountTotal,
          net: netTotal,
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