/**
 * Day Book Report
 * Unified endpoint — supports summary, details, and CSV export.
 *
 * Body params:
 *   dateFrom        (required YYYY-MM-DD)
 *   dateTo          (required YYYY-MM-DD)
 *   academicYear    (optional)
 *   className       (optional)
 *   mode            (optional — single string or array)
 *   includeReversals (default true)
 *   includeCancelled (default false)
 *   mode            "summary" | "details" | "export"  (default "summary")
 *   detailDate      (required when mode=details)
 *   page / pageSize (for details)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Payment entry types that represent actual cash/bank collections
const COLLECTION_TYPES = new Set([
  'CASH_PAYMENT',
  null,           // legacy rows with no entry_type treated as cash
  undefined,
  ''
]);

// Entry types that are always reversals (regardless of sign)
const REVERSAL_TYPES = new Set(['PAYMENT_REVERSAL', 'PAYMENT_REFUND', 'REVERSAL', 'CREDIT_REVERSAL']);

function classifyPayment(p) {
  const et = p.entry_type || '';
  const status = p.status || '';
  const amount = p.amount_paid ?? 0;

  // VOID: the original payment record that was marked REVERSED (and is NOT itself a reversal entry)
  // A REVERSAL entry (entry_type=REVERSAL) with status=Active should NOT be treated as void
  const isVoid = status === 'REVERSED' && !REVERSAL_TYPES.has(et);

  // REVERSAL ENTRY: explicitly created reversal row (entry_type is in REVERSAL_TYPES)
  // OR a negative amount cash payment (legacy negative rows)
  const isReversal = REVERSAL_TYPES.has(et) ||
    (!isVoid && amount < 0 && COLLECTION_TYPES.has(et));

  // CREDIT ADJUSTMENT: discounts etc. — excluded from cash day book
  const isCredit = et === 'CREDIT_ADJUSTMENT' && !isReversal && !isVoid;

  // Standard collection
  const isCollection = !isReversal && !isCredit && !isVoid;

  return { isVoid, isReversal, isCredit, isCollection };
}

function toCsvRow(r) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    r.postedAt,
    r.receiptNo,
    esc(r.student?.name ?? ''),
    r.student?.id ?? '',
    r.class?.name ?? '',
    r.mode,
    r.amount,
    r.isReversal ? 'YES' : '',
    r.status,
    r.invoiceId ?? '',
    esc(r.notes ?? '')
  ].join(',');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const allowedRoles = ['admin', 'principal', 'accountant'];
    if (!allowedRoles.includes((user.role || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      dateFrom,
      dateTo,
      academicYear,
      className,
      mode: filterMode,           // payment mode filter (string or array)
      includeReversals = true,
      includeCancelled = false,
      reportMode = 'summary',     // 'summary' | 'details' | 'export'
      detailDate,
      page = 1,
      pageSize = 100,
      exportCsv = false
    } = body;

    if (!dateFrom || !dateTo) {
      return Response.json({ error: 'dateFrom and dateTo are required' }, { status: 400 });
    }
    if (reportMode === 'details' && !detailDate) {
      return Response.json({ error: 'detailDate is required for details mode' }, { status: 400 });
    }

    const modeFilter = filterMode
      ? (Array.isArray(filterMode) ? filterMode : [filterMode]).map(m => m.toUpperCase())
      : null;

    // ── Fetch all payments in the date range ──────────────────────────────
    let payments = await base44.asServiceRole.entities.FeePayment.filter(
      academicYear ? { academic_year: academicYear } : {}
    );

    // Date filtering — use payment_date (reversal entries also use payment_date = reversal date)
    payments = payments.filter(p => {
      const d = p.payment_date || (p.created_date || '').split('T')[0];
      if (!d) return false;
      return d >= dateFrom && d <= dateTo;
    });

    // Mode filter
    if (modeFilter && modeFilter.length > 0) {
      payments = payments.filter(p => modeFilter.includes((p.payment_mode || 'CASH').toUpperCase()));
    }

    // Class filter — need invoice lookup
    // Build invoice map for class/student details
    const invoiceIds = [...new Set(payments.map(p => p.invoice_id).filter(Boolean))];
    let invoiceMap = {};
    if (invoiceIds.length > 0 && (className)) {
      // fetch invoices and build map
      const invs = await base44.asServiceRole.entities.FeeInvoice.filter(
        academicYear ? { academic_year: academicYear } : {}
      );
      for (const inv of invs) invoiceMap[inv.id] = inv;
      if (className) {
        const allowedInvoiceIds = new Set(
          Object.values(invoiceMap).filter(i => i.class_name === className).map(i => i.id)
        );
        payments = payments.filter(p => p.invoice_id && allowedInvoiceIds.has(p.invoice_id));
      }
    }

    // If we didn't fetch invoices yet, do it now for detail enrichment
    if (Object.keys(invoiceMap).length === 0) {
      const invs = await base44.asServiceRole.entities.FeeInvoice.filter(
        academicYear ? { academic_year: academicYear } : {}
      );
      for (const inv of invs) invoiceMap[inv.id] = inv;
    }

    // ── Build enriched rows ───────────────────────────────────────────────
    const allRows = [];
    const seenIds = new Set();

    for (const p of payments) {
      // Dedup by id
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);

      const { isVoid, isReversal, isCredit, isCollection } = classifyPayment(p);

      // Skip void/cancelled unless includeCancelled
      if (isVoid && !includeCancelled) continue;
      // Skip reversal entries unless includeReversals
      if (isReversal && !includeReversals) continue;
      // Skip pure credit adjustments (they don't appear in cash day book)
      if (isCredit) continue;

      const inv = invoiceMap[p.invoice_id];
      const payDate = p.payment_date || (p.created_date || '').split('T')[0];
      const modeRaw = (p.payment_mode || 'Cash');

      // Signed amount: reversals are negative
      let amount = p.amount_paid ?? 0;
      if (isReversal && amount > 0) amount = -amount;
      if (isVoid) amount = 0; // void rows show as 0

      const status = isVoid ? 'VOID' : (isReversal ? 'REVERSAL' : 'POSTED');

      allRows.push({
        id: p.id,
        date: payDate,
        postedAt: p.reversed_at || p.created_date || payDate,
        receiptNo: p.receipt_no || '',
        student: {
          id: p.student_id || inv?.student_id || '',
          name: p.student_name || inv?.student_name || ''
        },
        class: { name: p.class_name || inv?.class_name || '' },
        mode: modeRaw,
        modeUpper: modeRaw.toUpperCase(),
        amount,
        isReversal,
        isVoid,
        status,
        invoiceId: p.invoice_id || null,
        invoiceNo: inv?.installment_name || null,
        paymentId: p.id,
        notes: p.remarks || p.reversal_reason || null
      });
    }

    // Sort all rows by date desc, then postedAt desc
    allRows.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      if (a.postedAt > b.postedAt) return -1;
      if (a.postedAt < b.postedAt) return 1;
      return 0;
    });

    // ── DETAILS MODE ──────────────────────────────────────────────────────
    if (reportMode === 'details' || (reportMode === 'summary' && detailDate)) {
      const dateRows = allRows.filter(r => r.date === detailDate);
      const total = dateRows.length;
      const start = (page - 1) * pageSize;
      const paged = dateRows.slice(start, start + pageSize);
      return Response.json({
        meta: { date: detailDate, page, pageSize, totalRows: total },
        rows: paged.map(({ id, modeUpper, ...r }) => r)
      });
    }

    // ── EXPORT MODE ───────────────────────────────────────────────────────
    if (reportMode === 'export' || exportCsv) {
      const headers = ['Posted At', 'Receipt No', 'Student Name', 'Student ID', 'Class', 'Mode', 'Amount (₹)', 'Is Reversal', 'Status', 'Invoice ID', 'Notes'];
      const csvLines = [headers.join(','), ...allRows.map(toCsvRow)];
      return new Response(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=day-book-${dateFrom}-to-${dateTo}.csv`
        }
      });
    }

    // ── SUMMARY MODE (default) ────────────────────────────────────────────
    // Group by date
    const dateMap = {};
    for (const r of allRows) {
      if (!dateMap[r.date]) {
        dateMap[r.date] = { date: r.date, rows: [] };
      }
      dateMap[r.date].rows.push(r);
    }

    const computeTotals = (rows) => {
      const gross = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
      const reversed = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
      return { grossCollected: gross, grossReversed: reversed, netCollected: gross - reversed };
    };

    const computeByMode = (rows) => {
      const modeAgg = {};
      for (const r of rows) {
        const m = r.modeUpper;
        if (!modeAgg[m]) modeAgg[m] = { mode: r.mode, rows: [] };
        modeAgg[m].rows.push(r);
      }
      return Object.values(modeAgg).map(({ mode, rows: mrs }) => {
        const t = computeTotals(mrs);
        return { mode, count: mrs.length, ...t };
      }).sort((a, b) => b.grossCollected - a.grossCollected);
    };

    const days = Object.values(dateMap).map(({ date, rows: drows }) => ({
      date,
      ...computeTotals(drows),
      rowCount: drows.length,
      byMode: computeByMode(drows)
    }));

    // Sort days by date desc
    days.sort((a, b) => (a.date > b.date ? -1 : 1));

    // Global summary
    const overallTotals = computeTotals(allRows);
    const overallByMode = computeByMode(allRows);

    return Response.json({
      meta: { dateFrom, dateTo, academicYear: academicYear || null },
      summary: {
        ...overallTotals,
        byMode: overallByMode,
        totalRows: allRows.length
      },
      days
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});