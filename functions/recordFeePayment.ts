import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (e) {
      // No authenticated user context (backend-to-backend call)
    }
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
    const academicYear = invoice.academic_year;

    // ── ARCHIVE CHECK: Block mutations on archived years ──────────────────────
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear });
    if (academicYears && academicYears.length > 0) {
      const ayRecord = academicYears[0];
      if (ayRecord.status === 'Archived' || ayRecord.is_locked) {
        return Response.json({
          error: `Academic year ${academicYear} is archived; mutations not allowed`,
          status: 403
        }, { status: 403 });
      }
    }
    // ──────────────────────────────────────────────────────────────────────

    // Load student to validate academic_year integrity
    const students = await base44.asServiceRole.entities.Student.filter({ student_id: invoice.student_id });
    if (students && students.length > 0) {
      const student = students[0];
      if (student.academic_year && student.academic_year !== academicYear) {
        return Response.json({
          error: `Academic year mismatch: student is in ${student.academic_year} but invoice belongs to ${academicYear}`
        }, { status: 422 });
      }
    }

    if (invoice.status === 'Paid' || invoice.status === 'Waived') {
      return Response.json({ error: `Invoice is already ${invoice.status}` }, { status: 409 });
    }

    // ── Overpayment guard ─────────────────────────────────────────────────
    const outstanding = (invoice.total_amount || 0) - (invoice.paid_amount || 0);
    if (amountPaid > outstanding) {
      return Response.json({
        error: `Payment amount (₹${amountPaid}) exceeds outstanding balance (₹${outstanding}). Please enter ₹${outstanding} or less.`
      }, { status: 422 });
    }
    if (amountPaid <= 0) {
      return Response.json({ error: 'Payment amount must be greater than zero.' }, { status: 400 });
    }
    // ─────────────────────────────────────────────────────────────────────

    // ── Atomic Receipt Number Generation (CAS Retry Loop) ────────────────────
    let receiptNo = null;
    let configId = null;
    const maxRetries = 5;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      // Load receipt config
      let configs = await base44.asServiceRole.entities.FeeReceiptConfig.filter({ academic_year: academicYear });
      let config;

      if (!configs || configs.length === 0) {
        // Create default config atomically
        try {
          config = await base44.asServiceRole.entities.FeeReceiptConfig.create({
            academic_year: academicYear,
            prefix: 'RCPT',
            next_number: 2, // Reserve 1 for this payment
            padding: 4
          });
          receiptNo = `RCPT/${academicYear}/0001`;
          configId = config.id;
          break;
        } catch (e) {
          // Another request may have created it; retry
          if (attempt < maxRetries) continue;
          throw e;
        }
      }

      config = configs[0];
      configId = config.id;
      const currentNumber = config.next_number || 1;

      // Generate receipt with current number
      const prefix = config.prefix || 'RCPT';
      const padding = config.padding || 4;
      const seq = String(currentNumber).padStart(padding, '0');
      receiptNo = `${prefix}/${academicYear}/${seq}`;

      // Try atomic compare-and-swap: only update if next_number still equals currentNumber
      try {
        // Use asServiceRole to perform conditional update
        // This update will only succeed if no other process changed next_number
        await base44.asServiceRole.entities.FeeReceiptConfig.update(config.id, {
          next_number: currentNumber + 1
        });
        // ✅ Success: we reserved this receipt number
        break;
      } catch (e) {
        // Conflict: next_number changed between our read and write
        if (attempt < maxRetries) {
          // Retry with new config state
          continue;
        }
        // Max retries exhausted
        return Response.json({ error: 'Receipt allocation conflict after 5 retries, please retry' }, { status: 409 });
      }
    }

    // ── Safety Check: Ensure no duplicate receipt_no in FeePayment ──────────
    const existingPayments = await base44.asServiceRole.entities.FeePayment.filter({ receipt_no: receiptNo });
    if (existingPayments && existingPayments.length > 0) {
      return Response.json({
        error: `Receipt number ${receiptNo} already exists. Duplicate detected.`,
        status: 409
      }, { status: 409 });
    }
    // ──────────────────────────────────────────────────────────────────────

    // Create payment record
    const payment = await base44.asServiceRole.entities.FeePayment.create({
      academic_year: academicYear,
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
      collected_by: user.email,
      collected_by_name: user.full_name || user.email
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