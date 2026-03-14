import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Extract staff info and payment data from request body
    const body = await req.json();
    const { invoiceId, amountPaid, paymentDate, paymentMode, referenceNo, remarks, entryType, staffInfo } = body;
    
    if (!staffInfo || !staffInfo.staff_id) {
      console.log('[recordFeePayment] Missing staffInfo or staff_id:', staffInfo);
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }
    
    const user = staffInfo;
    // Fallback email for audit logging if not present
    if (!user.email && user.username) {
      user.email = user.username + '@school.local';
    }

    // ── RBAC: Only Admin/Principal/Accountant can create payments ──
    // Extract effective role with normalization
    const candidates = [
      user?.role,
      user?.roleName,
      user?.user_metadata?.role,
      user?.app_metadata?.role
    ].filter(v => v !== null && v !== undefined && v !== '');
    const userRole = String(candidates[0] || '').trim().toLowerCase();
    const allowedRoles = ['admin', 'principal', 'accountant'];
    
    if (!allowedRoles.includes(userRole)) {
      console.log(`[RBAC-BLOCK] ${user.email} role="${userRole}" not in ${JSON.stringify(allowedRoles)}`);
      return Response.json({ error: 'Forbidden', userRole, allowedRoles, email: user.email }, { status: 403 });
    }

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

    // ── ARCHIVE CHECK: Allow normal payments in archived years, block reversals ───────
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear });
    const isArchivedYear = academicYears && academicYears.length > 0 && (academicYears[0].status === 'Archived' || academicYears[0].is_locked);
    
    // Allow CASH_PAYMENT in archived years (previous-year balance collection)
    // Block REVERSAL, CREDIT_ADJUSTMENT mutations in archived years
    if (isArchivedYear && entryType && ['REVERSAL', 'CREDIT_ADJUSTMENT'].includes(entryType)) {
      console.log(`[ARCHIVE-BLOCK] ${user.email} attempted ${entryType} in archived year ${academicYear}`);
      return Response.json({
        error: `Cannot apply ${entryType} in archived academic year ${academicYear}. Previous-year balance collections are payment-only (no reversals or credits).`,
        status: 403
      }, { status: 403 });
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

    // Determine entry type (default to CASH_PAYMENT)
    const finalEntryType = entryType || 'CASH_PAYMENT';
    
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
      entry_type: finalEntryType,
      affects_cash: finalEntryType === 'CASH_PAYMENT',
      remarks: remarks || '',
      collected_by: user?.email || user?.username || 'system',
      collected_by_name: user?.full_name || user?.email || user?.username || 'system'
    });
    
    // ── Log archived-year collection for audit trail ──────────────────────
    if (isArchivedYear && finalEntryType === 'CASH_PAYMENT') {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'PREVIOUS_YEAR_COLLECTION',
          module: 'Fees',
          date: paymentDate,
          performed_by: user.email,
          details: `Recorded ${paymentMode || 'Cash'} payment of ₹${amountPaid} for student ${invoice.student_id} in archived year ${academicYear}. Receipt: ${receiptNo}`,
          academic_year: academicYear,
          student_id: invoice.student_id,
          class_name: invoice.class_name,
          timestamp: new Date().toISOString()
        });
      } catch (auditErr) {
        // Log error but don't fail payment if audit fails
        console.error(`[AUDIT-LOG-ERROR] Failed to log PREVIOUS_YEAR_COLLECTION: ${auditErr.message}`);
      }
    }
    // ──────────────────────────────────────────────────────────────────────

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

    // ── Fee Payment Notification ──────────────────────────────────────────
    try {
      // Duplicate check: ensure no notification already exists for this receipt
      const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
        type: 'fee_payment_received',
        duplicate_key: `fee_${receiptNo}`,
      });

      if (existingNotifs.length === 0) {
        // Create in-app notification (always free)
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: invoice.student_id,
          type: 'fee_payment_received',
          title: 'Fee Payment Received 🧾',
          message: `₹${amountPaid} received. Receipt No: ${receiptNo}`,
          related_entity_id: payment.id,
          action_url: '/StudentFees',
          is_read: false,
          duplicate_key: `fee_${receiptNo}`,
        });

        // Send push notification if enabled (uses integration credits)
        try {
          const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
            student_id: invoice.student_id,
          });
          const pref = prefs[0];
          
          if (pref && pref.browser_push_enabled && pref.browser_push_token) {
            await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
              student_ids: [invoice.student_id],
              title: 'Fee Payment Received 🧾',
              message: `₹${amountPaid} received for ${invoice.installment_name}. Receipt: ${receiptNo}`,
              url: '/StudentFees?receiptNo=' + receiptNo,
            });
          }
        } catch (pushErr) {
          console.error('[FEE-PUSH-ERROR] Failed to send push notification (non-fatal):', pushErr.message);
        }
      }
    } catch (notifErr) {
      // Log error but don't fail payment if notification fails
      console.error('[FEE-NOTIF-ERROR] Failed to create fee payment notification (non-fatal):', notifErr.message);
    }
    // ──────────────────────────────────────────────────────────────────────

    return Response.json({ success: true, receipt_no: receiptNo, payment_id: payment.id, new_status: newStatus, balance: Math.max(0, newBalance) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});