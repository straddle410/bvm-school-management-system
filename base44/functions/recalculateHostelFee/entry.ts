/**
 * Recalculate Hostel Fee for selected students (class-wise rates).
 *
 * UNIFIED RULE:
 *  - For all invoices (locked or unlocked): update fee_heads directly, recalculate totals.
 *  - Hostel is treated as a dynamic fee_head line, like Tuition, Kit, Transport.
 *
 * Idempotent: running twice for the same student/year is safe.
 * Admin-only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

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

    // Load school profile for hostel_fee_config (class-wise rates)
    const profiles = await base44.asServiceRole.entities.SchoolProfile.list();
    const hostelFeeConfig = profiles[0]?.hostel_fee_config || [];

    // Build a map: class_name -> amount
    const hostelRateByClass = {};
    for (const entry of hostelFeeConfig) {
      if (entry.class_name && entry.amount > 0) {
        hostelRateByClass[entry.class_name] = entry.amount;
      }
    }

    // Load students
    const allStudents = await base44.asServiceRole.entities.Student.filter({ academic_year: academicYear });
    const studentMap = {};
    for (const s of allStudents) {
      if (studentIds.includes(s.student_id)) studentMap[s.student_id] = s;
    }

    // Load annual invoices for these students in this year
    const allInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear });
    const invoiceMap = {};
    for (const inv of allInvoices) {
      if (!studentIds.includes(inv.student_id)) continue;
      if ((inv.invoice_type || 'ANNUAL') === 'ANNUAL' && inv.status !== 'Cancelled') {
        invoiceMap[inv.student_id] = inv;
      }
    }

    // Load all payments to check locked status + existing hostel adjustments
    const allPayments = await base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear });
    const paymentsByInvoice = {};
    const hostelAdjMap = {};
    for (const p of allPayments) {
      if (!p.invoice_id) continue;
      if (!paymentsByInvoice[p.invoice_id]) paymentsByInvoice[p.invoice_id] = [];
      paymentsByInvoice[p.invoice_id].push(p);
      if (p.entry_type === 'HOSTEL_ADJUSTMENT') {
        hostelAdjMap[p.invoice_id] = p;
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

      const hostelEnabled = !!student.hostel_enabled;
      const hostelFeeAmount = hostelRateByClass[student.class_name] || 0;

      // If hostel is enabled but no rate configured for this class — skip
      if (hostelEnabled && hostelFeeAmount === 0) {
        results.push({
          student_id: studentId,
          student_name: student.name,
          status: 'SKIP',
          reason: `No hostel fee rate configured for Class ${student.class_name}`,
          hostel_enabled: hostelEnabled
        });
        continue;
      }

      const feeHeads = invoice.fee_heads || [];
      const existingHostelLine = feeHeads.find(fh => fh.fee_head_id === 'hostel' || fh.fee_head_name === 'Hostel');
      const existingHostelAmt = existingHostelLine ? (existingHostelLine.amount || 0) : 0;

      const targetHostelAmt = hostelEnabled ? hostelFeeAmount : 0;
      const delta = targetHostelAmt - existingHostelAmt;

      const oldTotal = invoice.total_amount || 0;
      const newTotal = oldTotal + delta;

      if (newTotal < 0) {
        results.push({
          student_id: studentId,
          student_name: student.name,
          status: 'SKIP',
          reason: `Would result in negative total (₹${newTotal}). Skipped.`
        });
        continue;
      }

      if (delta === 0) {
        results.push({
          student_id: studentId,
          student_name: student.name,
          invoice_id: invoice.id,
          status: 'NO_CHANGE',
          reason: hostelEnabled
            ? `Hostel already applied (₹${existingHostelAmt.toLocaleString()})`
            : 'No hostel on invoice, hostel_enabled=false — nothing to do',
          old_total: oldTotal,
          new_total: oldTotal,
          hostel_enabled: hostelEnabled,
          existing_hostel_amount: existingHostelAmt,
          target_hostel_amount: targetHostelAmt
        });
        continue;
      }

      // Check if invoice is locked (has active payments)
      const invoicePayments = (paymentsByInvoice[invoice.id] || []).filter(p => {
        const s = (p.status || '').toUpperCase();
        return s !== 'VOID' && s !== 'CANCELLED' && !p.is_reversed && p.entry_type !== 'HOSTEL_ADJUSTMENT';
      });
      const isLocked = invoicePayments.length > 0;

      const action = isLocked
        ? (delta > 0 ? 'CREATE_DEBIT_ADJUSTMENT' : 'CREATE_CREDIT_ADJUSTMENT')
        : (delta > 0 ? 'EDIT_INVOICE_ADD_HOSTEL' : 'EDIT_INVOICE_REMOVE_HOSTEL');

      const previewData = {
        student_id: studentId,
        student_name: student.name,
        invoice_id: invoice.id,
        action,
        is_locked: isLocked,
        hostel_enabled: hostelEnabled,
        existing_hostel_amount: existingHostelAmt,
        target_hostel_amount: targetHostelAmt,
        delta,
        old_total: oldTotal,
        new_total: newTotal
      };

      if (previewOnly) {
        results.push({ ...previewData, status: 'PREVIEW' });
        continue;
      }

      // ── EXECUTE ────────────────────────────────────────────────────────────
      try {
        if (isLocked) {
           const existingAdj = hostelAdjMap[invoice.id];
           const adjAmount = targetHostelAmt; // Use target amount, not delta

           if (existingAdj) {
             // Always set to target amount, fixing any mismatches from prior runs
             const currentAmt = existingAdj.amount_paid || 0;
             if (targetHostelAmt === 0) {
               await base44.asServiceRole.entities.FeePayment.update(existingAdj.id, {
                 status: 'CANCELLED',
                 remarks: `Hostel adjustment cancelled — hostel_enabled=${hostelEnabled} — by ${user.email}`
               });
             } else if (currentAmt !== targetHostelAmt) {
               // Correct mismatched amount (e.g., from prior buggy cumulative runs)
               await base44.asServiceRole.entities.FeePayment.update(existingAdj.id, {
                 amount_paid: targetHostelAmt,
                 remarks: `Hostel adjustment corrected from ₹${currentAmt} to ₹${targetHostelAmt} — by ${user.email}`,
                 updated_by: user.email
               });
             }
           } else {
            const reason = delta > 0
              ? 'Hostel enabled after invoice generation'
              : 'Hostel disabled after invoice generation';
            await base44.asServiceRole.entities.FeePayment.create({
              student_id: student.student_id,
              invoice_id: invoice.id,
              academic_year: academicYear,
              amount_paid: adjAmount,
              payment_date: new Date().toISOString().split('T')[0],
              payment_mode: 'Adjustment',
              entry_type: 'HOSTEL_ADJUSTMENT',
              affects_cash: false,
              status: 'POSTED',
              remarks: reason,
              receipt_no: `HADJ-${student.student_id}-${academicYear}`,
              recorded_by: user.email
            });
          }

          results.push({ ...previewData, status: 'DONE', method: 'ADJUSTMENT' });

        } else {
          // Edit invoice directly
          let updatedFeeHeads;
          if (hostelEnabled) {
            if (existingHostelLine) {
              updatedFeeHeads = feeHeads.map(fh =>
                (fh.fee_head_id === 'hostel' || fh.fee_head_name === 'Hostel')
                  ? { ...fh, amount: hostelFeeAmount, gross_amount: hostelFeeAmount, net_amount: hostelFeeAmount }
                  : fh
              );
            } else {
              updatedFeeHeads = [
                ...feeHeads,
                { fee_head_name: 'Hostel', fee_head_id: 'hostel', amount: hostelFeeAmount, gross_amount: hostelFeeAmount, net_amount: hostelFeeAmount, discount_amount: 0, is_hostel: true }
              ];
            }
          } else {
            updatedFeeHeads = feeHeads.filter(fh => fh.fee_head_id !== 'hostel' && fh.fee_head_name !== 'Hostel');
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

          results.push({ ...previewData, status: 'DONE', method: 'INVOICE_EDITED' });
        }
      } catch (execErr) {
        results.push({ ...previewData, status: 'ERROR', error: execErr.message });
      }
    }

    const summary = {
      total: results.length,
      done: results.filter(r => r.status === 'DONE').length,
      no_change: results.filter(r => r.status === 'NO_CHANGE').length,
      skipped: results.filter(r => r.status === 'SKIP').length,
      errors: results.filter(r => r.status === 'ERROR').length
    };

    return Response.json({ success: true, previewOnly, summary, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});