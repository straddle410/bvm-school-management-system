/**
 * Outstanding / Due Report
 *
 * VOID-ONLY POLICY:
 *   - Payments with status VOID/CANCELLED are excluded from paid totals.
 *   - This means voiding a payment increases the student's outstanding balance.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VOID_STATUSES = new Set(['VOID', 'CANCELLED']);

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
      return Response.json({ error: 'Forbidden', userRole, allowedRoles }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
      academicYear,
      asOfDate,
      className,
      search,
      includeZeroOutstanding = false,
      onlyDue = false,
      onlyCredit = false,
      page = 1,
      pageSize = 200,
      sort = 'outstanding_desc',
      exportCsv = false
    } = body;

    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    const cutoff = asOfDate || new Date().toISOString().split('T')[0];

    const [invoices, payments] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear })
    ]);

    // Active invoices: not Cancelled, due on or before cutoff
    const activeInvoices = invoices.filter(inv => {
      if (inv.status === 'Cancelled') return false;
      const invDate = inv.due_date || inv.created_date;
      if (invDate && invDate > cutoff) return false;
      return true;
    });

    // Active payments: EXCLUDE VOID, up to cutoff
    const activePayments = payments.filter(p => {
      const rawStatus = (p.status || '').toUpperCase();
      if (VOID_STATUSES.has(rawStatus) || VOID_STATUSES.has(p.status)) return false;
      const pDate = p.payment_date || p.created_date;
      if (pDate && pDate > cutoff) return false;
      return true;
    });

    // Build per-student aggregates
    const studentMap = {};

    const ensure = (studentId, studentName, className_) => {
      if (!studentMap[studentId]) {
        studentMap[studentId] = {
          studentId,
          studentName: studentName || '',
          className: className_ || '',
          grossAmount: 0,
          discountAmount: 0,
          netInvoiced: 0,
          paidAmount: 0,
          lastPaymentDate: null,
          invoices: [],
          payments: []
        };
      }
      return studentMap[studentId];
    };

    // Aggregate invoices
    for (const inv of activeInvoices) {
      const row = ensure(inv.student_id, inv.student_name, inv.class_name);
      const gross = inv.gross_total ?? inv.total_amount ?? 0;
      const discount = inv.discount_total ?? 0;
      const net = inv.total_amount ?? 0;

      row.grossAmount += gross;
      row.discountAmount += discount;
      row.netInvoiced += net;
      row.invoices.push({
        id: inv.id,
        installment: inv.installment_name,
        dueDate: inv.due_date,
        gross,
        discount,
        net,
        status: inv.status
      });
    }

    // Aggregate payments (VOID already excluded above)
    for (const p of activePayments) {
      let contribution = 0;

      if (p.entry_type === 'CREDIT_ADJUSTMENT') {
        contribution = p.amount_paid || 0;
      } else {
        // Standard cash/UPI/bank payment — positive contribution
        contribution = p.amount_paid || 0;
        if (contribution < 0) contribution = 0; // guard: no negative standard payments
      }

      if (contribution === 0) continue;

      const inv = activeInvoices.find(i => i.id === p.invoice_id) ||
                  invoices.find(i => i.id === p.invoice_id);
      const sid = p.student_id || inv?.student_id;
      if (!sid) continue;

      const row = ensure(sid, p.student_name || inv?.student_name, p.class_name || inv?.class_name);
      row.paidAmount += contribution;

      if (p.payment_date && (!row.lastPaymentDate || p.payment_date > row.lastPaymentDate)) {
        row.lastPaymentDate = p.payment_date;
      }
      row.payments.push({
        id: p.id,
        receiptNo: p.receipt_no,
        date: p.payment_date,
        mode: p.payment_mode,
        amount: contribution,
        entryType: p.entry_type,
        remarks: p.remarks
      });
    }

    let rows = Object.values(studentMap).map(row => {
      const rawOutstanding = row.netInvoiced - row.paidAmount;
      const dueAmount = Math.max(rawOutstanding, 0);
      const creditBalance = Math.max(-rawOutstanding, 0);
      return {
        student: { id: row.studentId, name: row.studentName },
        class: { name: row.className },
        grossAmount: row.grossAmount,
        discountAmount: row.discountAmount,
        netInvoiced: row.netInvoiced,
        paidAmount: row.paidAmount,
        rawOutstanding,
        dueAmount,
        creditBalance,
        outstanding: dueAmount,
        lastPaymentDate: row.lastPaymentDate,
        _invoices: row.invoices,
        _payments: row.payments
      };
    });

    // Filters
    if (className)  rows = rows.filter(r => r.class.name === className);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.student.name.toLowerCase().includes(q) ||
        r.student.id.toLowerCase().includes(q)
      );
    }
    if (onlyDue)         rows = rows.filter(r => r.rawOutstanding > 0);
    else if (onlyCredit) rows = rows.filter(r => r.rawOutstanding < 0);
    else if (!includeZeroOutstanding) rows = rows.filter(r => r.rawOutstanding !== 0);

    // Sort
    if (sort === 'outstanding_desc') rows.sort((a, b) => b.dueAmount - a.dueAmount);
    else if (sort === 'outstanding_asc') rows.sort((a, b) => a.dueAmount - b.dueAmount);
    else if (sort === 'name_asc') rows.sort((a, b) => a.student.name.localeCompare(b.student.name));
    else if (sort === 'name_desc') rows.sort((a, b) => b.student.name.localeCompare(a.student.name));

    const totalDue    = rows.reduce((s, r) => s + r.dueAmount, 0);
    const totalCredit = rows.reduce((s, r) => s + r.creditBalance, 0);
    const summary = {
      totalGross: rows.reduce((s, r) => s + r.grossAmount, 0),
      totalDiscount: rows.reduce((s, r) => s + r.discountAmount, 0),
      totalNetInvoiced: rows.reduce((s, r) => s + r.netInvoiced, 0),
      totalPaid: rows.reduce((s, r) => s + r.paidAmount, 0),
      totalDue,
      totalCredit,
      netReceivable: totalDue - totalCredit,
      totalOutstanding: totalDue,
      countDueStudents: rows.filter(r => r.rawOutstanding > 0).length,
      countCreditStudents: rows.filter(r => r.rawOutstanding < 0).length,
      countTotal: rows.length,
      countStudents: rows.length
    };

    if (exportCsv) {
      const headers = ['Student ID', 'Student Name', 'Class', 'Gross (₹)', 'Discount (₹)', 'Net Invoiced (₹)', 'Paid (₹)', 'Raw Outstanding (₹)', 'Due (₹)', 'Credit Balance (₹)', 'Last Payment Date'];
      const csvRows = rows.map(r => [
        r.student.id,
        `"${r.student.name}"`,
        r.class.name,
        r.grossAmount.toFixed(2),
        r.discountAmount.toFixed(2),
        r.netInvoiced.toFixed(2),
        r.paidAmount.toFixed(2),
        r.rawOutstanding.toFixed(2),
        r.dueAmount.toFixed(2),
        r.creditBalance.toFixed(2),
        r.lastPaymentDate || ''
      ].join(','));
      const csv = [headers.join(','), ...csvRows].join('\n');
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=outstanding-report-${cutoff}.csv`
        }
      });
    }

    const totalRows = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize).map(r => {
      const { _invoices, _payments, ...rest } = r;
      return rest;
    });

    return Response.json({
      meta: { page, pageSize, totalRows, asOfDate: cutoff, academicYear },
      summary,
      rows: pageRows
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});