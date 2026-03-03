import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json().catch(() => ({}));
    const {
      studentId,
      academicYear,
      dateFrom,
      dateTo,
      includeReversals = true,
      includeCredits = true,
      includeVoided = false,
      exportCsv = false,
      page = 1,
      pageSize = 200,
    } = body;

    if (!studentId) {
      return Response.json({ error: 'studentId is required' }, { status: 400 });
    }

    // Fetch student info
    const students = await base44.asServiceRole.entities.Student.filter({ student_id: studentId });
    const student = students[0] || null;

    // Build invoice + payment filter
    const invFilter = { student_id: studentId };
    const payFilter = { student_id: studentId };
    if (academicYear) {
      invFilter.academic_year = academicYear;
      payFilter.academic_year = academicYear;
    }

    const [invoices, payments] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter(invFilter),
      base44.asServiceRole.entities.FeePayment.filter(payFilter)
    ]);

    const rows = [];

    // --- INVOICE ROWS (DEBIT) ---
    for (const inv of invoices) {
      if (inv.status === 'Cancelled') continue;

      const net = inv.total_amount ?? 0;
      const invDate = inv.due_date || (inv.created_date ? inv.created_date.split('T')[0] : null);

      rows.push({
        _sortDate: invDate || '0000-00-00',
        date: invDate,
        type: 'INVOICE',
        refNo: inv.id ? `INV-${inv.id.slice(-6).toUpperCase()}` : null,
        description: inv.installment_name || inv.title || 'Fee Invoice',
        debit: net,
        credit: 0,
        mode: null,
        invoiceId: inv.id,
        paymentId: null,
        status: inv.status === 'Waived' ? 'VOID' : 'POSTED',
        _waived: inv.status === 'Waived'
      });
    }

    // --- PAYMENT / REVERSAL / CREDIT ROWS ---
    const seenPaymentIds = new Set();
    for (const p of payments) {
      if (seenPaymentIds.has(p.id)) continue;
      seenPaymentIds.add(p.id);

      const pDate = p.payment_date || (p.created_date ? p.created_date.split('T')[0] : null);
      const amount = p.amount_paid ?? 0;

      // Detect reversal entries (entries that UNDO a prior payment — posted, affect balance)
      const isReversalEntry = 
        p.entry_type === 'REVERSAL' ||
        p.entry_type === 'PAYMENT_REVERSAL' ||
        p.entry_type === 'PAYMENT_REFUND' ||
        (p.affects_cash === true && amount < 0);

      // Detect VOID: original payment that was cancelled (the parent, not the reversal child)
      const isVoided = p.status === 'REVERSED' && !isReversalEntry;

      const isCredit = p.entry_type === 'CREDIT_ADJUSTMENT';

      // Apply filters
      if (isVoided && !includeVoided) continue;
      if (isReversalEntry && !includeReversals) continue;
      if (isCredit && !includeCredits) continue;

      let type, debit, credit, status, description;

      if (isVoided) {
        // VOID: original payment was reversed — exclude from balance math
        status = 'VOID';
        type = 'PAYMENT';
        debit = 0;
        credit = 0;
        description = `Payment ${p.receipt_no || ''} (Voided${p.reversal_reason ? ': ' + p.reversal_reason : ''})`;
      } else if (isReversalEntry) {
        // REVERSAL: a posted entry that cancels a prior payment — INCREASES outstanding
        status = 'POSTED';
        type = 'REVERSAL';
        debit = Math.abs(amount); // adds back to receivable
        credit = 0;
        description = `Reversal${p.reversal_reason ? ': ' + p.reversal_reason : ''} (${p.receipt_no || ''})`;
      } else if (isCredit) {
        status = 'POSTED';
        type = 'CREDIT';
        debit = 0;
        credit = Math.abs(amount);
        description = `Credit Adjustment${p.remarks ? ': ' + p.remarks : ''} (${p.receipt_no || ''})`;
      } else {
        // Standard CASH / UPI / bank payment
        status = 'POSTED';
        type = 'PAYMENT';
        debit = 0;
        credit = Math.abs(amount);
        description = `${p.payment_mode || 'Payment'} received (${p.receipt_no || ''})`;
      }

      rows.push({
        _sortDate: pDate || '0000-00-00',
        date: pDate,
        type,
        refNo: p.receipt_no ? `RCPT-${p.receipt_no}` : null,
        description,
        debit,
        credit,
        mode: p.payment_mode || null,
        invoiceId: p.invoice_id || null,
        paymentId: p.id,
        status,
        _raw: p
      });
    }

    // Sort chronologically
    rows.sort((a, b) => {
      if (a._sortDate < b._sortDate) return -1;
      if (a._sortDate > b._sortDate) return 1;
      // invoices before payments on same day
      if (a.type === 'INVOICE' && b.type !== 'INVOICE') return -1;
      if (a.type !== 'INVOICE' && b.type === 'INVOICE') return 1;
      return 0;
    });

    // Apply date filters
    let filtered = rows;
    if (dateFrom) filtered = filtered.filter(r => !r.date || r.date >= dateFrom);
    if (dateTo) filtered = filtered.filter(r => !r.date || r.date <= dateTo);

    // Opening balance = net effect of all POSTED rows BEFORE dateFrom
    let openingBalance = 0;
    if (dateFrom) {
      const before = rows.filter(r => r.date && r.date < dateFrom && r.status === 'POSTED');
      openingBalance = before.reduce((s, r) => s + r.debit - r.credit, 0);
    }

    // Compute running balances
    let running = openingBalance;
    const withBalance = filtered.map(r => {
      if (r.status === 'POSTED') {
        running += r.debit - r.credit;
      }
      const { _sortDate, _raw, _waived, ...rest } = r;
      return { ...rest, runningBalance: running };
    });

    const closingBalance = running;

    // Summary
    const postedRows = withBalance.filter(r => r.status === 'POSTED');
    const totalInvoiced = postedRows.filter(r => r.type === 'INVOICE').reduce((s, r) => s + r.debit, 0);
    const totalPaid = postedRows.filter(r => ['PAYMENT', 'CREDIT'].includes(r.type)).reduce((s, r) => s + r.credit, 0);
    const totalReversed = postedRows.filter(r => r.type === 'REVERSAL').reduce((s, r) => s + r.debit, 0);

    // CSV export
    if (exportCsv) {
      const headers = ['Date', 'Type', 'Ref No', 'Description', 'Debit (₹)', 'Credit (₹)', 'Running Balance (₹)', 'Mode', 'Status'];
      const csvRows = withBalance.map(r => [
        r.date || '',
        r.type,
        r.refNo || '',
        `"${r.description}"`,
        r.debit.toFixed(2),
        r.credit.toFixed(2),
        r.runningBalance.toFixed(2),
        r.mode || '',
        r.status
      ].join(','));
      const csv = [headers.join(','), ...csvRows].join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=ledger-${studentId}.csv`
        }
      });
    }

    // Paginate
    const totalRows = withBalance.length;
    const start = (page - 1) * pageSize;
    const pageRows = withBalance.slice(start, start + pageSize);

    return Response.json({
      meta: { studentId, academicYear: academicYear || null, dateFrom: dateFrom || null, dateTo: dateTo || null, page, pageSize, totalRows },
      student: student ? {
        id: student.student_id,
        name: student.name,
        className: student.class_name,
        section: student.section,
        phone: student.parent_phone || null
      } : null,
      openingBalance,
      closingBalance,
      summary: { totalInvoiced, totalPaid, totalReversed, netOutstanding: closingBalance },
      rows: pageRows
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});