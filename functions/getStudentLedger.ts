/**
 * Student Ledger Report
 *
 * VOID-ONLY POLICY:
 *   - VOID/REVERSED payments are excluded by default (includeVoided=false).
 *   - When includeVoided=true, VOID rows appear with debit=0, credit=0 and do NOT
 *     affect the running balance — purely for audit visibility.
 *   - No negative "reversal entry" rows exist in this system.
 *   - Running balance: Invoice debits increase it; POSTED payments decrease it.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Statuses that mark a payment as voided (zero financial effect)
const VOID_STATUSES = new Set(['VOID', 'CANCELLED']);

// Valid active statuses for payments that affect balance
const ACTIVE_STATUSES = new Set(['', null, undefined, 'POSTED', 'Active', 'ACTIVE']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // ── RBAC: Only Admin/Principal/Accountant can access ──
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
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
    console.log(`[RBAC-ALLOW] ${user.email} role="${userRole}"`);

    const body = await req.json().catch(() => ({}));
    const {
      studentId,
      academicYear,
      dateFrom,
      dateTo,
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

    // Build filters
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

    // ── INVOICE ROWS (DEBIT) ───────────────────────────────────────────────
    for (const inv of invoices) {
      if (inv.status === 'Cancelled') continue;

      const net = inv.total_amount ?? 0;
      const invDate = inv.due_date || (inv.created_date ? inv.created_date.split('T')[0] : null);

      rows.push({
        _sortDate: invDate || '0000-00-00',
        _sortType: 0,
        _id: inv.id,
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
      });
    }

    // ── PAYMENT ROWS ──────────────────────────────────────────────────────
    const seenIds = new Set();
    for (const p of payments) {
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);

      const pDate = p.payment_date || (p.created_date ? p.created_date.split('T')[0] : null);
      const amount = p.amount_paid ?? 0;
      const rawStatus = (p.status || '').toUpperCase();

      // Classify payment type
      const isVoid = VOID_STATUSES.has(rawStatus) || VOID_STATUSES.has(p.status);
      const isTransportAdj = !isVoid && p.entry_type === 'TRANSPORT_ADJUSTMENT';
      const isCredit = !isVoid && !isTransportAdj && p.entry_type === 'CREDIT_ADJUSTMENT';

      // Apply filters
      if (isVoid && !includeVoided) continue;
      if (isCredit && !includeCredits) continue;

      let type, debit, credit, status, description;

      if (isVoid) {
        // VOID: shown for audit only, zero financial effect
        type = 'PAYMENT';
        status = 'VOID';
        debit = 0;
        credit = 0;
        description = `Payment ${p.receipt_no || ''} (Voided${p.void_reason || p.reversal_reason ? ': ' + (p.void_reason || p.reversal_reason) : ''})`;
      } else if (isTransportAdj) {
        // TRANSPORT_ADJUSTMENT: affects balance but NOT cash collection
        // Positive amount_paid = DEBIT (owed more) | Negative = CREDIT (owed less)
        type = 'TRANSPORT_ADJUSTMENT';
        status = 'POSTED';
        if (amount > 0) {
          debit = Math.abs(amount);
          credit = 0;
          description = `Transport adjustment: +₹${Math.abs(amount).toLocaleString()} (${p.remarks || ''})`;
        } else {
          debit = 0;
          credit = Math.abs(amount);
          description = `Transport adjustment: -₹${Math.abs(amount).toLocaleString()} (${p.remarks || ''})`;
        }
      } else if (isCredit) {
        type = 'CREDIT';
        status = 'POSTED';
        debit = 0;
        credit = Math.abs(amount);
        description = `Credit Adjustment${p.remarks ? ': ' + p.remarks : ''} (${p.receipt_no || ''})`;
      } else {
        // Standard cash/UPI/bank payment
        type = 'PAYMENT';
        status = 'POSTED';
        debit = 0;
        credit = Math.abs(amount);
        description = `${p.payment_mode || 'Payment'} received (${p.receipt_no || ''})`;
      }

      rows.push({
        _sortDate: pDate || '0000-00-00',
        _sortType: isVoid ? 3 : (isTransportAdj ? 2 : isCredit ? 2 : 1),
        _id: p.id,
        date: pDate,
        type,
        refNo: p.receipt_no || null,
        description,
        debit,
        credit,
        mode: isTransportAdj ? 'Adjustment' : (p.payment_mode || null),
        invoiceId: p.invoice_id || null,
        paymentId: p.id,
        status,
        affects_cash: isTransportAdj ? false : true,
      });
    }

    // Sort: date asc → type order (INVOICE=0, PAYMENT=1, CREDIT=2, VOID=3) → id
    rows.sort((a, b) => {
      if (a._sortDate < b._sortDate) return -1;
      if (a._sortDate > b._sortDate) return 1;
      if (a._sortType !== b._sortType) return a._sortType - b._sortType;
      return a._id < b._id ? -1 : a._id > b._id ? 1 : 0;
    });

    // Date range filter
    let filtered = rows;
    if (dateFrom) filtered = filtered.filter(r => !r.date || r.date >= dateFrom);
    if (dateTo)   filtered = filtered.filter(r => !r.date || r.date <= dateTo);

    // Opening balance = POSTED rows before dateFrom
    let openingBalance = 0;
    if (dateFrom) {
      const before = rows.filter(r => r.date && r.date < dateFrom && r.status === 'POSTED');
      openingBalance = before.reduce((s, r) => s + r.debit - r.credit, 0);
    }

    // Running balance: only POSTED rows affect it
    let running = openingBalance;
    const withBalance = filtered.map(r => {
      if (r.status === 'POSTED') {
        running += r.debit - r.credit;
      }
      const { _sortDate, _sortType, _id, ...rest } = r;
      return { ...rest, runningBalance: running };
    });

    const closingBalance = running;

    // Summary: only POSTED rows count
    const postedRows = withBalance.filter(r => r.status === 'POSTED');
    const totalInvoiced = postedRows.filter(r => r.type === 'INVOICE').reduce((s, r) => s + r.debit, 0);
    
    // Paid total: SUM of real payments + credit adjustments (excludes TRANSPORT_ADJUSTMENT)
    // TRANSPORT_ADJUSTMENT entries affect balance but NOT cash collection totals
    const totalPaid     = postedRows.filter(r => ['PAYMENT', 'CREDIT'].includes(r.type)).reduce((s, r) => s + r.credit, 0);
    
    const voidCount     = withBalance.filter(r => r.status === 'VOID').length;

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
      summary: { totalInvoiced, totalPaid, voidCount, netOutstanding: closingBalance },
      rows: pageRows
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});