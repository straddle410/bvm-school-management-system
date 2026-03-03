/**
 * Collection Report backend function
 * Uses the same classifyPayment logic as getDayBookReport.
 * Supports: summary, details, export (CSV) modes.
 * Permissions: admin, principal, accountant only.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const COLLECTION_TYPES = new Set(['CASH_PAYMENT', null, undefined, '']);
const REVERSAL_TYPES = new Set(['PAYMENT_REVERSAL', 'PAYMENT_REFUND', 'REVERSAL', 'CREDIT_REVERSAL']);

function classifyPayment(p) {
  const et = p.entry_type || '';
  const status = p.status || '';
  const amount = p.amount_paid ?? 0;

  const isVoid = status === 'REVERSED' && !REVERSAL_TYPES.has(et);
  const isReversal = REVERSAL_TYPES.has(et) || (!isVoid && amount < 0 && COLLECTION_TYPES.has(et));
  const isCredit = et === 'CREDIT_ADJUSTMENT' && !isReversal && !isVoid;
  const isCollection = !isReversal && !isCredit && !isVoid;

  // Signed amount for display
  let signedAmount = amount;
  if (isReversal && signedAmount > 0) signedAmount = -signedAmount;
  if (isVoid) signedAmount = 0;

  return { isVoid, isReversal, isCredit, isCollection, signedAmount };
}

function toCsvRow(r) {
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    r.date,
    r.receiptNo,
    esc(r.studentName),
    r.studentId,
    r.className,
    r.mode,
    r.signedAmount,
    r.type,
    r.status,
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
      academicYear,
      dateFrom,
      dateTo,
      className,
      paymentMode,
      search,
      includeReversals = true,
      includeVoided = false,
      reportMode = 'list', // 'list' | 'export'
      page = 1,
      pageSize = 500
    } = body;

    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    // Fetch all payments for this academic year
    let payments = await base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear });

    // Date filter
    if (dateFrom || dateTo) {
      payments = payments.filter(p => {
        const d = p.payment_date || (p.created_date || '').split('T')[0];
        if (!d) return false;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        return true;
      });
    }

    // Payment mode filter
    if (paymentMode) {
      payments = payments.filter(p => p.payment_mode === paymentMode);
    }

    // Class filter
    if (className) {
      payments = payments.filter(p => p.class_name === className);
    }

    // Classify and filter
    const rows = [];
    for (const p of payments) {
      const { isVoid, isReversal, isCredit, isCollection, signedAmount } = classifyPayment(p);

      // Skip credits (discounts) — never in cash report
      if (isCredit) continue;
      // Skip void originals unless requested
      if (isVoid && !includeVoided) continue;
      // Skip reversal entries unless requested
      if (isReversal && !includeReversals) continue;

      const d = p.payment_date || (p.created_date || '').split('T')[0];

      const type = isVoid ? 'VOID' : isReversal ? 'REVERSAL' : 'PAYMENT';
      const status = isVoid ? 'VOID' : 'POSTED';

      // Build description: reversal entries reference original receipt
      let notes = p.remarks || '';
      if (isReversal && p.original_receipt_no) {
        notes = `Reversal of ${p.original_receipt_no}${p.reversal_reason ? '. ' + p.reversal_reason : ''}`;
      } else if (isReversal && p.reference_no) {
        notes = `Reversal of ${p.reference_no}${p.reversal_reason ? '. ' + p.reversal_reason : ''}`;
      }

      rows.push({
        id: p.id,
        date: d || '',
        receiptNo: p.receipt_no || '',
        studentName: p.student_name || '',
        studentId: p.student_id || '',
        className: p.class_name || '',
        mode: p.payment_mode || 'Cash',
        amount: p.amount_paid ?? 0,
        signedAmount,
        type,
        status,
        isVoid,
        isReversal,
        isCollection,
        originalPaymentId: p.original_payment_id || null,
        originalReceiptNo: p.original_receipt_no || null,
        reversalReceiptNo: p.reversal_receipt_no || null,
        reversedAt: p.reversed_at || null,
        notes
      });
    }

    // Search filter (receipt no or student name)
    let filtered = rows;
    if (search) {
      const q = search.toLowerCase();
      filtered = rows.filter(r =>
        r.receiptNo.toLowerCase().includes(q) ||
        r.studentName.toLowerCase().includes(q) ||
        r.studentId.toLowerCase().includes(q)
      );
    }

    // Sort by date desc, then receipt desc
    filtered.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return (b.receiptNo > a.receiptNo) ? 1 : -1;
    });

    // CSV export
    if (reportMode === 'export') {
      const headers = ['Date', 'Receipt No', 'Student Name', 'Student ID', 'Class', 'Mode', 'Amount (₹)', 'Type', 'Status', 'Notes'];
      const summaryRows = [
        [],
        ['SUMMARY'],
        ['Gross Collected', filtered.filter(r => r.isCollection).reduce((s, r) => s + r.amount, 0)],
        ['Gross Reversed', filtered.filter(r => r.isReversal).reduce((s, r) => s + Math.abs(r.amount), 0)],
        ['Net Collected', filtered.filter(r => !r.isVoid).reduce((s, r) => s + r.signedAmount, 0)]
      ];
      const csvLines = [headers.join(','), ...filtered.map(toCsvRow), ...summaryRows.map(r => r.join(','))];
      return new Response(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=collection-report-${academicYear}.csv`
        }
      });
    }

    // Summary stats
    const grossCollected = filtered.filter(r => r.isCollection).reduce((s, r) => s + r.amount, 0);
    const grossReversed = filtered.filter(r => r.isReversal).reduce((s, r) => s + Math.abs(r.amount), 0);
    const netCollected = grossCollected - grossReversed;

    // Mode breakdown
    const modeMap = {};
    for (const r of filtered.filter(r => !r.isVoid)) {
      if (!modeMap[r.mode]) modeMap[r.mode] = 0;
      modeMap[r.mode] += r.signedAmount;
    }

    // Paginate
    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return Response.json({
      summary: { grossCollected, grossReversed, netCollected, modeBreakdown: modeMap },
      meta: { total, page, pageSize },
      rows: paged
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});