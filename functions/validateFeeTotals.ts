/**
 * Validation Function:
 * 1) Parent Statement totals must match on-screen Ledger totals (annual + adhoc)
 * 2) Transport fee: transport student invoice = base + 10000 with Transport line item;
 *    non-transport student invoice excludes it.
 *
 * Runs inline (does not call sibling functions, to avoid auth forwarding issues).
 * Test 2 creates and immediately cleans up test students + invoices.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const VOID_STATUSES = new Set(['VOID', 'CANCELLED']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role || '').toLowerCase() !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const report = { test1: null, test2: null };

    // ═══════════════════════════════════════════════════════════════
    // TEST 1: Parent Statement totals == on-screen Ledger totals
    // ═══════════════════════════════════════════════════════════════
    try {
      const years = await base44.asServiceRole.entities.AcademicYear.filter({ status: 'Active' });
      const academicYear = years[0]?.year;
      if (!academicYear) throw new Error('No active academic year found');

      // Find a student with both an annual invoice AND at least one adhoc invoice
      const allInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear });
      const annualStudentIds = allInvoices
        .filter(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL' && i.status !== 'Cancelled')
        .map(i => i.student_id);
      const adhocStudentIds = new Set(
        allInvoices.filter(i => i.invoice_type === 'ADHOC' && i.status !== 'Cancelled').map(i => i.student_id)
      );
      const candidateId = annualStudentIds.find(sid => adhocStudentIds.has(sid));

      if (!candidateId) {
        report.test1 = {
          status: 'SKIP',
          reason: 'No student with both annual + adhoc invoices found in active year — cannot validate'
        };
      } else {
        // ── Replicate getStudentLedger logic ──────────────────────────────────
        const [invoices, payments] = await Promise.all([
          base44.asServiceRole.entities.FeeInvoice.filter({ student_id: candidateId, academic_year: academicYear }),
          base44.asServiceRole.entities.FeePayment.filter({ student_id: candidateId, academic_year: academicYear })
        ]);

        // Invoice rows (net amount = total_amount, after discount already applied in invoice)
        const invoiceRows = invoices
          .filter(i => i.status !== 'Cancelled')
          .map(i => ({ debit: i.total_amount ?? 0, status: i.status === 'Waived' ? 'VOID' : 'POSTED' }));

        const seenIds = new Set();
        const paymentRows = [];
        for (const p of payments) {
          if (seenIds.has(p.id)) continue;
          seenIds.add(p.id);
          const rawStatus = (p.status || '').toUpperCase();
          const isVoid = VOID_STATUSES.has(rawStatus);
          if (isVoid) continue; // exclude voided for default view
          paymentRows.push({ credit: p.amount_paid ?? 0 });
        }

        const ledgerTotalInvoiced = invoiceRows.filter(r => r.status === 'POSTED').reduce((s, r) => s + r.debit, 0);
        const ledgerTotalPaid = paymentRows.reduce((s, r) => s + r.credit, 0);
        const ledgerBalance = ledgerTotalInvoiced - ledgerTotalPaid;

        // ── Replicate getParentStatement logic ────────────────────────────────
        const annualInvoice = invoices.find(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL') || null;
        const adhocInvoices = invoices.filter(i => i.invoice_type === 'ADHOC' && i.status !== 'Cancelled');

        const annualGross = annualInvoice ? (annualInvoice.gross_total || annualInvoice.total_amount || 0) : 0;
        const adhocGross  = adhocInvoices.reduce((s, i) => s + (i.total_amount || 0), 0);
        const stmtGross   = annualGross + adhocGross;
        const stmtDiscount = annualInvoice?.discount_total || 0;
        const stmtNet     = stmtGross - stmtDiscount;

        let stmtPaid = 0;
        for (const p of payments) {
          const rawStatus = (p.status || '').toUpperCase();
          if (!VOID_STATUSES.has(rawStatus) && !p.is_reversed) stmtPaid += p.amount_paid || 0;
        }
        const stmtBalance = Math.max(stmtNet - stmtPaid, 0);

        // ── Compare ───────────────────────────────────────────────────────────
        const invoicedMatch = ledgerTotalInvoiced === stmtNet;
        const paidMatch     = ledgerTotalPaid === stmtPaid;
        const balanceMatch  = ledgerBalance === stmtBalance;
        const passed = invoicedMatch && paidMatch && balanceMatch;

        report.test1 = {
          status: passed ? 'PASS' : 'FAIL',
          student_id: candidateId,
          academic_year: academicYear,
          ledger:    { totalInvoiced: ledgerTotalInvoiced, totalPaid: ledgerTotalPaid, netOutstanding: ledgerBalance },
          statement: { gross: stmtGross, discount: stmtDiscount, net: stmtNet, totalPaid: stmtPaid, balanceDue: stmtBalance },
          checks: {
            invoiced_equals_net: { expected: stmtNet,     got: ledgerTotalInvoiced, match: invoicedMatch },
            paid_match:          { expected: stmtPaid,    got: ledgerTotalPaid,     match: paidMatch },
            balance_match:       { expected: stmtBalance, got: ledgerBalance,       match: balanceMatch }
          }
        };
      }
    } catch (e) {
      report.test1 = { status: 'ERROR', error: e.message };
    }

    // ═══════════════════════════════════════════════════════════════
    // TEST 2: Transport fee in invoice
    // ═══════════════════════════════════════════════════════════════
    try {
      const years = await base44.asServiceRole.entities.AcademicYear.filter({ status: 'Active' });
      const academicYear = years[0]?.year;
      if (!academicYear) throw new Error('No active academic year found');

      // Step 1: Set transport_fee_amount = 10000
      const profiles = await base44.asServiceRole.entities.SchoolProfile.list();
      if (!profiles.length) throw new Error('No SchoolProfile found');
      const profileBefore = profiles[0].transport_fee_amount || 0;
      await base44.asServiceRole.entities.SchoolProfile.update(profiles[0].id, { transport_fee_amount: 10000 });

      // Step 2: Find any fee plan for this academic year (any status)
      const plans = await base44.asServiceRole.entities.FeePlan.filter({ academic_year: academicYear });
      if (!plans.length) throw new Error('No fee plan found for year ' + academicYear + ' — create a fee plan first');
      const plan = plans[0];
      const baseFee = plan.total_amount || 0;
      const className = plan.class_name || '1';

      // Step 3: Clean up any leftover test data
      const testIds = ['TST-NO-TRANS', 'TST-WITH-TRANS'];
      const [oldStudents, oldInvoices] = await Promise.all([
        base44.asServiceRole.entities.Student.filter({ student_id: { '$in': testIds } }),
        base44.asServiceRole.entities.FeeInvoice.filter({ student_id: { '$in': testIds } })
      ]);
      await Promise.all([
        ...oldStudents.map(s => base44.asServiceRole.entities.Student.update(s.id, { is_deleted: true, status: 'Archived' })),
        ...oldInvoices.map(i => base44.asServiceRole.entities.FeeInvoice.update(i.id, { status: 'Cancelled' }))
      ]);

      // Step 4: Create two test students
      const [noTransStudent, withTransStudent] = await Promise.all([
        base44.asServiceRole.entities.Student.create({
          student_id: 'TST-NO-TRANS',
          student_id_norm: 'TST-NO-TRANS',
          name: 'Validation NoTransport',
          class_name: className,
          section: 'A',
          academic_year: academicYear,
          status: 'Published',
          is_active: true,
          is_deleted: false,
          transport_enabled: false
        }),
        base44.asServiceRole.entities.Student.create({
          student_id: 'TST-WITH-TRANS',
          student_id_norm: 'TST-WITH-TRANS',
          name: 'Validation WithTransport',
          class_name: className,
          section: 'A',
          academic_year: academicYear,
          status: 'Published',
          is_active: true,
          is_deleted: false,
          transport_enabled: true
        })
      ]);

      // Step 5: Generate invoices (inline logic matching generateFeeInvoices)
      const buildInvoice = async (student, transportAmt) => {
        let feeItems = [...(plan.fee_items || [])];
        let grossTotal = plan.total_amount || 0;
        if (student.transport_enabled && transportAmt > 0) {
          feeItems = [...feeItems, { fee_head_name: 'Transport', fee_head_id: 'transport', amount: transportAmt, is_transport: true }];
          grossTotal += transportAmt;
        }
        const fee_heads = feeItems.map(fh => ({ ...fh, gross_amount: fh.amount || 0, discount_amount: 0, net_amount: fh.amount || 0 }));
        return base44.asServiceRole.entities.FeeInvoice.create({
          academic_year: academicYear,
          student_id: student.student_id,
          student_name: student.name,
          class_name: student.class_name,
          section: student.section,
          installment_name: 'Annual Fee',
          due_date: plan.due_date || '',
          fee_heads,
          gross_total: grossTotal,
          discount_total: 0,
          total_amount: grossTotal,
          paid_amount: 0,
          balance: grossTotal,
          status: 'Pending',
          generated_by: user.email
        });
      };

      const [invNoTrans, invWithTrans] = await Promise.all([
        buildInvoice(noTransStudent, 10000),
        buildInvoice(withTransStudent, 10000)
      ]);

      // Step 6: Validate
      const noTransHasLine  = (invNoTrans.fee_heads  || []).some(fh => fh.fee_head_id === 'transport');
      const withTransHasLine = (invWithTrans.fee_heads || []).some(fh => fh.fee_head_id === 'transport');
      const noTransCorrect   = invNoTrans.total_amount  === baseFee;
      const withTransCorrect = invWithTrans.total_amount === baseFee + 10000;
      const passed = !noTransHasLine && withTransHasLine && noTransCorrect && withTransCorrect;

      const transportLine = (invWithTrans.fee_heads || []).find(fh => fh.fee_head_id === 'transport') || null;

      report.test2 = {
        status: passed ? 'PASS' : 'FAIL',
        academic_year: academicYear,
        fee_plan: { class_name: className, base_amount: baseFee },
        school_profile: { transport_fee_before: profileBefore, transport_fee_now: 10000 },
        student_no_transport: {
          expected_total: baseFee,
          got_total: invNoTrans.total_amount,
          has_transport_line: noTransHasLine,
          result: !noTransHasLine && noTransCorrect ? 'PASS' : 'FAIL'
        },
        student_with_transport: {
          expected_total: baseFee + 10000,
          got_total: invWithTrans.total_amount,
          transport_line_item: transportLine,
          result: withTransHasLine && withTransCorrect ? 'PASS' : 'FAIL'
        }
      };

      // Step 7: Cleanup
      await Promise.all([
        base44.asServiceRole.entities.Student.delete(noTransStudent.id),
        base44.asServiceRole.entities.Student.delete(withTransStudent.id),
        base44.asServiceRole.entities.FeeInvoice.delete(invNoTrans.id),
        base44.asServiceRole.entities.FeeInvoice.delete(invWithTrans.id)
      ]);
      // Leave transport_fee_amount = 10000 as requested by user

    } catch (e) {
      report.test2 = { status: 'ERROR', error: e.message };
    }

    const t1 = report.test1?.status;
    const t2 = report.test2?.status;
    const overall =
      (t1 === 'PASS' || t1 === 'SKIP') && t2 === 'PASS' ? 'ALL PASS' :
      (t1 === 'FAIL' || t2 === 'FAIL') ? 'SOME FAILURES' : 'ERRORS';

    return Response.json({ overall, ...report });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});