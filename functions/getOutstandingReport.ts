import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

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

    // Fetch invoices and payments in parallel
    const [invoices, payments] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear })
    ]);

    // Filter invoices: only active (not Cancelled/Waived), up to cutoff date
    const activeInvoices = invoices.filter(inv => {
      if (['Cancelled'].includes(inv.status)) return false;
      const invDate = inv.due_date || inv.created_date;
      if (invDate && invDate > cutoff) return false;
      return true;
    });

    // Filter payments: only active (not REVERSED), up to cutoff
    const activePayments = payments.filter(p => {
      if (p.status === 'REVERSED') return false;
      const pDate = p.payment_date || p.created_date;
      if (pDate && pDate > cutoff) return false;
      return true;
    });

    // Build per-student aggregates
    const studentMap = {}; // studentId -> aggregate

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

    // Aggregate payments
    for (const p of activePayments) {
      // Determine contribution:
      // CASH_PAYMENT: adds to paid (positive amount_paid)
      // REVERSAL: reduces paid (amount_paid is negative, or we subtract it)
      // CREDIT_ADJUSTMENT: only reduces outstanding if affects_cash is explicitly false
      //   Wave 2 rule: credit adjustments that affect receivable ARE counted

      let contribution = 0;
      if (p.entry_type === 'CASH_PAYMENT') {
        contribution = p.amount_paid || 0;
      } else if (p.entry_type === 'REVERSAL') {
        // Reversals have negative amount_paid or we negate positive
        contribution = p.amount_paid || 0; // amount_paid should already be negative
        if (contribution > 0) contribution = -contribution; // ensure negative
      } else if (p.entry_type === 'CREDIT_ADJUSTMENT') {
        // Include credit adjustments that reduce receivable (affects_cash = false but reduces balance)
        contribution = p.amount_paid || 0;
      }

      if (contribution === 0) continue;

      // Find invoice to get student info if not in studentMap
      const inv = activeInvoices.find(i => i.id === p.invoice_id) || 
                  invoices.find(i => i.id === p.invoice_id);
      const sid = p.student_id || inv?.student_id;
      if (!sid) continue;

      const row = ensure(sid, p.student_name || inv?.student_name, p.class_name || inv?.class_name);
      row.paidAmount += contribution;

      if (p.payment_date) {
        if (!row.lastPaymentDate || p.payment_date > row.lastPaymentDate) {
          row.lastPaymentDate = p.payment_date;
        }
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

    // Build rows — no clamping, signed balance
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
        rawOutstanding,   // signed: negative = overpaid
        dueAmount,        // positive debt only
        creditBalance,    // overpayment only
        // legacy compat field kept for anything reading "outstanding"
        outstanding: dueAmount,
        lastPaymentDate: row.lastPaymentDate,
        _invoices: row.invoices,
        _payments: row.payments
      };
    });

    // Apply filters
    if (className) {
      rows = rows.filter(r => r.class.name === className);
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(r =>
        r.student.name.toLowerCase().includes(q) ||
        r.student.id.toLowerCase().includes(q)
      );
    }
    // Exclusive mode filters
    if (onlyDue)    rows = rows.filter(r => r.rawOutstanding > 0);
    else if (onlyCredit) rows = rows.filter(r => r.rawOutstanding < 0);
    else if (!includeZeroOutstanding) rows = rows.filter(r => r.rawOutstanding !== 0);

    // Sort
    if (sort === 'outstanding_desc') rows.sort((a, b) => b.dueAmount - a.dueAmount);
    else if (sort === 'outstanding_asc') rows.sort((a, b) => a.dueAmount - b.dueAmount);
    else if (sort === 'name_asc') rows.sort((a, b) => a.student.name.localeCompare(b.student.name));
    else if (sort === 'name_desc') rows.sort((a, b) => b.student.name.localeCompare(a.student.name));

    // Summary across all rows (before pagination)
    const totalDue     = rows.reduce((s, r) => s + r.dueAmount, 0);
    const totalCredit  = rows.reduce((s, r) => s + r.creditBalance, 0);
    const summary = {
      totalGross: rows.reduce((s, r) => s + r.grossAmount, 0),
      totalDiscount: rows.reduce((s, r) => s + r.discountAmount, 0),
      totalNetInvoiced: rows.reduce((s, r) => s + r.netInvoiced, 0),
      totalPaid: rows.reduce((s, r) => s + r.paidAmount, 0),
      totalDue,
      totalCredit,
      netReceivable: totalDue - totalCredit,
      totalOutstanding: totalDue, // legacy compat
      countDueStudents: rows.filter(r => r.rawOutstanding > 0).length,
      countCreditStudents: rows.filter(r => r.rawOutstanding < 0).length,
      countTotal: rows.length,
      countStudents: rows.length // legacy compat
    };

    // CSV export
    if (exportCsv) {
      const headers = ['Student ID', 'Student Name', 'Class', 'Gross (₹)', 'Discount (₹)', 'Net Invoiced (₹)', 'Paid (₹)', 'Outstanding (₹)', 'Last Payment Date'];
      const csvRows = rows.map(r => [
        r.student.id,
        `"${r.student.name}"`,
        r.class.name,
        r.grossAmount.toFixed(2),
        r.discountAmount.toFixed(2),
        r.netInvoiced.toFixed(2),
        r.paidAmount.toFixed(2),
        r.outstanding.toFixed(2),
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

    // Paginate
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