/**
 * Recalculate Transport Fee for selected students.
 *
 * SAFE RULES:
 *  - Invoice with NO payments → edit lines directly, recompute totals.
 *  - Invoice WITH payments    → create/update a TRANSPORT_ADJUSTMENT FeePayment entry
 *                               (entry_type="TRANSPORT_ADJUSTMENT", affects_cash=false).
 * Idempotent: running twice for the same student/year is safe (detects existing adjustments).
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { studentIds, academicYear, previewOnly = false } = await req.json();

    if (!studentIds?.length || !academicYear) {
      return Response.json({ error: 'studentIds and academicYear are required' }, { status: 400 });
    }

    // Load school profile for transport fee amount
    const profiles = await base44.asServiceRole.entities.SchoolProfile.list();
    const transportFeeAmount = profiles[0]?.transport_fee_amount || 0;

    // Load students
    const allStudents = await base44.asServiceRole.entities.Student.filter({ academic_year: academicYear });
    const studentMap = {};
    for (const s of allStudents) {
      if (studentIds.includes(s.student_id)) studentMap[s.student_id] = s;
    }

    // Load annual invoices for these students in this year
    const allInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear });
    const invoiceMap = {}; // student_id -> annual invoice
    for (const inv of allInvoices) {
      if (!studentIds.includes(inv.student_id)) continue;
      if ((inv.invoice_type || 'ANNUAL') === 'ANNUAL' && inv.status !== 'Cancelled') {
        invoiceMap[inv.student_id] = inv;
      }
    }

    // Load all payments for these students (to check locked status)
    const allPayments = await base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear });
    const paymentsByInvoice = {}; // invoice_id -> payments[]
    const transportAdjMap = {}; // invoice_id -> TRANSPORT_ADJUSTMENT payment
    for (const p of allPayments) {
      if (!p.invoice_id) continue;
      if (!paymentsByInvoice[p.invoice_id]) paymentsByInvoice[p.invoice_id] = [];
      paymentsByInvoice[p.invoice_id].push(p);
      if (p.entry_type === 'TRANSPORT_ADJUSTMENT') {
        transportAdjMap[p.invoice_id] = p;
      }
    }

    const results = [];

    for (const studentId of studentIds) {
      const student = studentMap[studentId];
      if (!student) {
        results.push({ student_id: studentId, status: 'SKIP', reason: 'Student not found in academic year' });
        continue;
      }

      const invoice = invoiceMap[studentId];
      if (!invoice) {
        results.push({ student_id: studentId, student_name: student.name, status: 'SKIP', reason: 'No annual invoice found' });
        continue;
      }

      const transportEnabled = !!student.transport_enabled;
      const feeHeads = invoice.fee_heads || [];
      const existingTransportLine = feeHeads.find(fh => fh.fee_head_id === 'transport' || fh.fee_head_name === 'Transport');
      const existingTransportAmt = existingTransportLine ? (existingTransportLine.amount || 0) : 0;

      // Determine what the target transport amount should be
      const targetTransportAmt = transportEnabled ? transportFeeAmount : 0;
      const delta = targetTransportAmt - existingTransportAmt; // positive = add, negative = remove, 0 = no change

      const oldTotal = invoice.total_amount || 0;
      const newTotal = oldTotal + delta;

      // Guard: no negative totals
      if (newTotal < 0) {
        results.push({
          student_id: studentId,
          student_name: student.name,
          status: 'SKIP',
          reason: `Would result in negative total (₹${newTotal}). Skipped.`
        });
        continue;
      }

      // No change needed
      if (delta === 0) {
        results.push({
          student_id: studentId,
          student_name: student.name,
          invoice_id: invoice.id,
          status: 'NO_CHANGE',
          reason: transportEnabled
            ? `Transport already applied (₹${existingTransportAmt.toLocaleString()})`
            : 'No transport on invoice, transport_enabled=false — nothing to do',
          old_total: oldTotal,
          new_total: oldTotal,
          transport_enabled: transportEnabled,
          existing_transport_amount: existingTransportAmt,
          target_transport_amount: targetTransportAmt
        });
        continue;
      }

      // Check if invoice is locked (has active payments)
      const invoicePayments = (paymentsByInvoice[invoice.id] || []).filter(p => {
        const s = (p.status || '').toUpperCase();
        return s !== 'VOID' && s !== 'CANCELLED' && !p.is_reversed && p.entry_type !== 'TRANSPORT_ADJUSTMENT';
      });
      const isLocked = invoicePayments.length > 0;

      const action = isLocked
        ? (delta > 0 ? 'CREATE_DEBIT_ADJUSTMENT' : 'CREATE_CREDIT_ADJUSTMENT')
        : (delta > 0 ? 'EDIT_INVOICE_ADD_TRANSPORT' : 'EDIT_INVOICE_REMOVE_TRANSPORT');

      const preview = {
        student_id: studentId,
        student_name: student.name,
        invoice_id: invoice.id,
        action,
        is_locked: isLocked,
        transport_enabled: transportEnabled,
        existing_transport_amount: existingTransportAmt,
        target_transport_amount: targetTransportAmt,
        delta,
        old_total: oldTotal,
        new_total: newTotal
      };

      if (previewOnly) {
        results.push({ ...preview, status: 'PREVIEW' });
        continue;
      }

      // ── EXECUTE ────────────────────────────────────────────────────────────
      try {
        if (isLocked) {
          // Create or update TRANSPORT_ADJUSTMENT payment entry
          const existingAdj = transportAdjMap[invoice.id];
          const adjAmount = delta; // positive = debit (owed more), negative = credit (owed less)

          if (existingAdj) {
            // Update existing adjustment
            const prevAdjAmt = existingAdj.amount_paid || 0;
            const combinedDelta = prevAdjAmt + adjAmount;
            if (combinedDelta === 0) {
              // Cancel it out — delete the adjustment
              await base44.asServiceRole.entities.FeePayment.update(existingAdj.id, {
                status: 'CANCELLED',
                remarks: `Transport adjustment cancelled — transport_enabled=${transportEnabled} — by ${user.email}`
              });
            } else {
              await base44.asServiceRole.entities.FeePayment.update(existingAdj.id, {
                amount_paid: combinedDelta,
                remarks: `Transport adjustment updated: ₹${combinedDelta} — transport_enabled=${transportEnabled} — by ${user.email}`,
                updated_by: user.email
              });
            }
          } else {
            const reason = delta > 0
              ? 'Transport enabled after invoice generation'
              : 'Transport disabled after invoice generation';
            await base44.asServiceRole.entities.FeePayment.create({
              student_id: student.student_id,
              invoice_id: invoice.id,
              academic_year: academicYear,
              amount_paid: adjAmount,
              payment_date: new Date().toISOString().split('T')[0],
              payment_mode: 'Adjustment',
              entry_type: 'TRANSPORT_ADJUSTMENT',
              affects_cash: false,
              status: 'POSTED',
              remarks: reason,
              receipt_no: `TADJ-${student.student_id}-${academicYear}`,
              recorded_by: user.email
            });
          }

          results.push({ ...preview, status: 'DONE', method: 'ADJUSTMENT' });

        } else {
          // Edit invoice directly
          let updatedFeeHeads;
          if (transportEnabled) {
            // Add transport line if not present, or update amount
            if (existingTransportLine) {
              updatedFeeHeads = feeHeads.map(fh =>
                (fh.fee_head_id === 'transport' || fh.fee_head_name === 'Transport')
                  ? { ...fh, amount: transportFeeAmount, gross_amount: transportFeeAmount, net_amount: transportFeeAmount }
                  : fh
              );
            } else {
              updatedFeeHeads = [
                ...feeHeads,
                { fee_head_name: 'Transport', fee_head_id: 'transport', amount: transportFeeAmount, gross_amount: transportFeeAmount, net_amount: transportFeeAmount, discount_amount: 0, is_transport: true }
              ];
            }
          } else {
            // Remove transport line
            updatedFeeHeads = feeHeads.filter(fh => fh.fee_head_id !== 'transport' && fh.fee_head_name !== 'Transport');
          }

          const newGross = updatedFeeHeads.reduce((s, fh) => s + (fh.amount || 0), 0);
          const discountTotal = invoice.discount_total || 0;
          const newNet = Math.max(newGross - discountTotal, 0);
          const paidSoFar = invoice.paid_amount || 0;
          const newBalance = Math.max(newNet - paidSoFar, 0);

          await base44.asServiceRole.entities.FeeInvoice.update(invoice.id, {
            fee_heads: updatedFeeHeads,
            gross_total: newGross,
            total_amount: newNet,
            balance: newBalance
          });

          results.push({ ...preview, status: 'DONE', method: 'INVOICE_EDITED' });
        }
      } catch (execErr) {
        results.push({ ...preview, status: 'ERROR', error: execErr.message });
      }
    }

    const summary = {
      total: results.length,
      done: results.filter(r => r.status === 'DONE').length,
      no_change: results.filter(r => r.status === 'NO_CHANGE').length,
      skipped: results.filter(r => r.status === 'SKIP').length,
      errors: results.filter(r => r.status === 'ERROR').length,
      transport_fee_amount: transportFeeAmount
    };

    return Response.json({ success: true, previewOnly, summary, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});