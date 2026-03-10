/**
 * Day Book Report
 *
 * VOID-ONLY POLICY:
 *   - VOID payments are excluded from totals always.
 *   - Toggle "includeVoided" (default false) shows VOID rows for audit but they
 *     are NEVER added to gross/net totals.
 *   - No negative reversal rows in this system.
 *
 * Body params:
 *   dateFrom         (required YYYY-MM-DD)
 *   dateTo           (required YYYY-MM-DD)
 *   academicYear     (optional)
 *   className        (optional)
 *   mode             (optional — single string or array)
 *   includeVoided    (default false) — show VOID rows for audit, never counted in totals
 *   reportMode       "summary" | "details" | "export" (default "summary")
 *   detailDate       (required when reportMode=details)
 *   page / pageSize  (for details)
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VOID_STATUSES = new Set(['VOID', 'CANCELLED']);

function classifyPayment(p) {
  const rawStatus = (p.status || '').toUpperCase();
  const isVoid = VOID_STATUSES.has(rawStatus) || VOID_STATUSES.has(p.status);

  // Credit adjustments (internal entries, not cash)
  const isCredit = !isVoid && p.entry_type === 'CREDIT_ADJUSTMENT';

  // Standard collection row
  const isCollection = !isVoid && !isCredit;

  return { isVoid, isCredit, isCollection };
}

function toCsvRow(r) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    r.date,
    r.receiptNo,
    esc(r.student?.name ?? ''),
    r.student?.id ?? '',
    r.class?.name ?? '',
    r.mode,
    r.isVoid ? 0 : r.amount,
    r.isVoid ? 'VOID' : r.status,
    r.notes ? esc(r.notes) : ''
  ].join(',');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Get staff info from request headers (sent from frontend)
    const staffToken = req.headers.get('x-staff-token');
    if (!staffToken) {
      return Response.json({ error: 'Unauthorized: No staff token' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      dateFrom,
      dateTo,
      academicYear,
      className,
      mode: filterMode,
      includeVoided = false,
      // Legacy alias — treat includeCancelled same as includeVoided
      includeCancelled,
      reportMode = 'summary',
      detailDate,
      page = 1,
      pageSize = 100,
      exportCsv = false
    } = body;

    const showVoided = includeVoided || includeCancelled || false;

    if (!dateFrom || !dateTo) {
      return Response.json({ error: 'dateFrom and dateTo are required' }, { status: 400 });
    }
    if (reportMode === 'details' && !detailDate) {
      return Response.json({ error: 'detailDate is required for details mode' }, { status: 400 });
    }

    const modeFilter = filterMode
      ? (Array.isArray(filterMode) ? filterMode : [filterMode]).map(m => m.toUpperCase())
      : null;

    // ── Fetch payments in date range ──────────────────────────────────────
    let payments = await base44.asServiceRole.entities.FeePayment.filter(
      academicYear ? { academic_year: academicYear } : {}
    );

    // Date filter by payment_date
    payments = payments.filter(p => {
      const d = p.payment_date || (p.created_date || '').split('T')[0];
      return d && d >= dateFrom && d <= dateTo;
    });

    // Payment mode filter
    if (modeFilter && modeFilter.length > 0) {
      payments = payments.filter(p => modeFilter.includes((p.payment_mode || 'CASH').toUpperCase()));
    }

    // Invoice map (for class/student enrichment)
    const invoiceMap = {};
    const invs = await base44.asServiceRole.entities.FeeInvoice.filter(
      academicYear ? { academic_year: academicYear } : {}
    );
    for (const inv of invs) invoiceMap[inv.id] = inv;

    // Class filter
    if (className) {
      const allowedInvoiceIds = new Set(
        Object.values(invoiceMap).filter(i => i.class_name === className).map(i => i.id)
      );
      payments = payments.filter(p => p.invoice_id && allowedInvoiceIds.has(p.invoice_id));
    }

    // ── Build enriched rows ───────────────────────────────────────────────
    const allRows = [];
    const seenIds = new Set();

    for (const p of payments) {
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);

      const { isVoid, isCredit, isCollection } = classifyPayment(p);

      // Credit adjustments are internal, not shown in day book
      if (isCredit) continue;
      // Voided rows only if requested
      if (isVoid && !showVoided) continue;
      // Guard: skip negative-amount non-void entries (old test/legacy data)
      if (!isVoid && (p.amount_paid ?? 0) <= 0) continue;

      const inv = invoiceMap[p.invoice_id];
      const payDate = p.payment_date || (p.created_date || '').split('T')[0];
      const modeRaw = p.payment_mode || 'Cash';

      // VOID rows: amount always 0 for totals
      const amount = isVoid ? 0 : (p.amount_paid ?? 0);
      const status = isVoid ? 'VOID' : 'POSTED';

      allRows.push({
        id: p.id,
        date: payDate,
        receiptNo: p.receipt_no || '',
        student: {
          id: p.student_id || inv?.student_id || '',
          name: p.student_name || inv?.student_name || ''
        },
        class: { name: p.class_name || inv?.class_name || '' },
        mode: modeRaw,
        modeUpper: modeRaw.toUpperCase(),
        amount,           // 0 for VOID
        rawAmount: p.amount_paid ?? 0,  // original amount (display only)
        isVoid,
        status,
        invoiceId: p.invoice_id || null,
        invoiceNo: inv?.installment_name || null,
        paymentId: p.id,
        notes: p.void_reason || p.reversal_reason || p.remarks || null
      });
    }

    // Sort: date desc, then id desc
    allRows.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return a.id > b.id ? -1 : 1;
    });

    // ── DETAILS MODE ──────────────────────────────────────────────────────
    if (reportMode === 'details' || (reportMode === 'summary' && detailDate)) {
      const dateRows = allRows.filter(r => r.date === detailDate);
      const total = dateRows.length;
      const start = (page - 1) * pageSize;
      const paged = dateRows.slice(start, start + pageSize);
      return Response.json({
        meta: { date: detailDate, page, pageSize, totalRows: total },
        rows: paged.map(({ modeUpper, ...r }) => r)
      });
    }

    // ── EXPORT MODE ───────────────────────────────────────────────────────
    if (reportMode === 'export' || exportCsv) {
      const headers = ['Date', 'Receipt No', 'Student Name', 'Student ID', 'Class', 'Mode', 'Amount (₹)', 'Status', 'Notes'];
      const csvLines = [headers.join(','), ...allRows.map(toCsvRow)];
      return new Response(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=day-book-${dateFrom}-to-${dateTo}.csv`
        }
      });
    }

    // ── SUMMARY MODE ──────────────────────────────────────────────────────
    // CRITICAL: totals count ONLY non-VOID rows (amount field is already 0 for VOID)
    const computeTotals = (rows) => {
      const grossCollected = rows
        .filter(r => !r.isVoid)
        .reduce((s, r) => s + r.amount, 0);
      const voidedAmount = rows
        .filter(r => r.isVoid)
        .reduce((s, r) => s + r.rawAmount, 0);
      return { grossCollected, grossReversed: 0, netCollected: grossCollected, voidedAmount };
    };

    const computeByMode = (rows) => {
      const modeAgg = {};
      for (const r of rows) {
        if (r.isVoid) continue; // VOID rows not counted in mode breakdown
        const m = r.modeUpper;
        if (!modeAgg[m]) modeAgg[m] = { mode: r.mode, count: 0, grossCollected: 0 };
        modeAgg[m].count++;
        modeAgg[m].grossCollected += r.amount;
      }
      return Object.values(modeAgg).map(m => ({
        ...m,
        grossReversed: 0,
        netCollected: m.grossCollected
      })).sort((a, b) => b.grossCollected - a.grossCollected);
    };

    // Group by date
    const dateMap = {};
    for (const r of allRows) {
      if (!dateMap[r.date]) dateMap[r.date] = { date: r.date, rows: [] };
      dateMap[r.date].rows.push(r);
    }

    const days = Object.values(dateMap).map(({ date, rows: drows }) => ({
      date,
      ...computeTotals(drows),
      rowCount: drows.length,
      validCount: drows.filter(r => !r.isVoid).length,
      voidCount: drows.filter(r => r.isVoid).length,
      byMode: computeByMode(drows)
    }));

    days.sort((a, b) => (a.date > b.date ? -1 : 1));

    const overallTotals = computeTotals(allRows);
    const overallByMode = computeByMode(allRows);

    return Response.json({
      meta: { dateFrom, dateTo, academicYear: academicYear || null },
      summary: {
        ...overallTotals,
        byMode: overallByMode,
        totalRows: allRows.length,
        validRows: allRows.filter(r => !r.isVoid).length,
        voidRows: allRows.filter(r => r.isVoid).length
      },
      days
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});