import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    console.log("FUNCTION CALLED: recordFeePayment");
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

    // ── ARCHIVE CHECK: Block reversals only (simplified, no AcademicYear lookup) ───────
    // For archived years, only block REVERSAL and CREDIT_ADJUSTMENT
    if (entryType && ['REVERSAL', 'CREDIT_ADJUSTMENT'].includes(entryType)) {
      console.log(`[ARCHIVE-BLOCK] ${user.email} attempted ${entryType}`);
      return Response.json({
        error: `Cannot apply ${entryType}. Use payments only.`,
        status: 403
      }, { status: 403 });
    }
    // ──────────────────────────────────────────────────────────────────────

    // Skip student validation - invoice academic_year is authoritative

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

    // ── Receipt Generation using FeeReceiptConfig ────────────────────
    // Fetch config for this academic year
    const configs = await base44.asServiceRole.entities.FeeReceiptConfig.filter({ academic_year: academicYear });
    let config = configs?.[0];
    
    // Use defaults if no config exists
    const prefix = config?.prefix || 'RCPT';
    const padding = config?.padding || 4;
    const nextNumber = config?.next_number || 1;
    
    const seq = String(nextNumber).padStart(padding, '0');
    const receiptNo = `${prefix}/${academicYear}/${seq}`;
    
    // Defer receipt config update to background (don't await)
    (async () => {
      try {
        if (config) {
          await base44.asServiceRole.entities.FeeReceiptConfig.update(config.id, {
            next_number: nextNumber + 1
          });
        } else {
          await base44.asServiceRole.entities.FeeReceiptConfig.create({
            academic_year: academicYear,
            prefix: prefix,
            padding: padding,
            next_number: 2
          });
        }
      } catch (err) {
        console.error('[RECEIPT-CONFIG-ERROR] Failed to update receipt config (non-fatal):', err.message);
      }
    })();

    // Determine entry type (default to CASH_PAYMENT)
    const finalEntryType = entryType || 'CASH_PAYMENT';
    
    // Freeze receipt snapshot BEFORE payment (captures state at that moment)
    const receiptSnapshot = {
      invoice_gross_total: invoice.gross_total || 0,
      invoice_discount_total: invoice.discount_total || 0,
      invoice_net_total: invoice.total_amount || 0,
      total_paid_before: invoice.paid_amount || 0,
      balance_before: (invoice.total_amount || 0) - (invoice.paid_amount || 0)
    };

    // Create payment record with frozen snapshot
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
      collected_by_name: user?.full_name || user?.email || user?.username || 'system',
      receipt_snapshot: receiptSnapshot
    });
    
    // ── Log payment for audit trail (Fire-and-Forget) ──────
    (async () => {
      try {
        await base44.asServiceRole.entities.AuditLog.create({
          action: 'PREVIOUS_YEAR_COLLECTION',
          module: 'Fees',
          date: paymentDate,
          performed_by: user.email,
          details: `Recorded ${paymentMode || 'Cash'} payment of ₹${amountPaid} for student ${invoice.student_id}. Receipt: ${receiptNo}`,
          academic_year: academicYear,
          student_id: invoice.student_id,
          class_name: invoice.class_name,
          timestamp: new Date().toISOString()
        });
      } catch (auditErr) {
        console.error(`[AUDIT-LOG-ERROR] Failed to log payment: ${auditErr.message}`);
      }
    })();
    // ──────────────────────────────────────────────────────────────────────

    // Update invoice paid_amount and status
    const newPaid = (invoice.paid_amount || 0) + amountPaid;
    const newBalance = invoice.total_amount - newPaid;
    let newStatus = 'Partial';
    if (newBalance <= 0) newStatus = 'Paid';
    else if (newPaid === 0) newStatus = 'Pending';

    // Defer invoice update to background (don't await)
    (async () => {
      try {
        await base44.asServiceRole.entities.FeeInvoice.update(invoice.id, {
          paid_amount: newPaid,
          balance: Math.max(0, newBalance),
          status: newStatus
        });
      } catch (err) {
        console.error('[INVOICE-UPDATE-ERROR] Failed to update invoice (non-fatal):', err.message);
      }
    })();

    // ── Fee Payment Notification ──────────────────────────────────────────
    // Notifications are triggered by FeePayment entity automation (sendFeePaymentNotification)
    // This avoids context loss in async fire-and-forget patterns
    // ──────────────────────────────────────────────────────────────────────

    // Test WhatsApp notification
    try {
      await base44.asServiceRole.functions.invoke('sendFeePaymentNotification', {
        student_id: payment.student_id,
        student_name: payment.student_name,
        class_name: payment.class_name,
        amount_paid: payment.amount_paid,
        receipt_no: payment.receipt_no,
        id: payment.id
      });
    } catch (err) {
      console.log("WA ERROR (ignored):", err);
    }

    return Response.json({ success: true, receipt_no: receiptNo, payment_id: payment.id, new_status: newStatus, balance: Math.max(0, newBalance) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});