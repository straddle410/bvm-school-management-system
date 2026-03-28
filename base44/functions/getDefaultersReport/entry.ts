/**
 * Defaulters Report Endpoint
 * Uses IDENTICAL balance calculation logic as getStudentLedger to ensure data matches.
 * Balance = sum(debits) - sum(credits) for POSTED rows, where:
 *   - Invoices (non-cancelled/waived) → debit += total_amount
 *   - TRANSPORT_ADJUSTMENT/HOSTEL_ADJUSTMENT positive → debit, negative → credit
 *   - CREDIT_ADJUSTMENT → credit
 *   - Standard payments → credit
 *   - VOID payments → excluded
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const VOID_STATUSES = new Set(['VOID', 'CANCELLED']);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    console.log('ALL params:', body);

    const academicYear = body.academicYear || new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString().slice(-2);
    const className = body.className || null;
    console.log('className filter value:', className);
    const section = body.section || null;
    const minDue = parseFloat(body.minDue) || 1;
    const daysSinceLastPaymentMinParam = body.daysSinceLastPaymentMin;
    const daysSinceLastPaymentMin = daysSinceLastPaymentMinParam !== null && daysSinceLastPaymentMinParam !== '' ? parseInt(daysSinceLastPaymentMinParam) : null;
    const followUpStatus = body.status ? body.status.split(',') : null;
    const search = body.search?.trim().toLowerCase() || null;
    const sort = body.sort || 'due_desc';
    const page = parseInt(body.page) || 1;
    const pageSize = parseInt(body.pageSize) || 50;
    const skipCount = (page - 1) * pageSize;

    // Fetch all data in parallel
    const [invoices, payments, allStudents, followUps, academicYears] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.Student.filter({ academic_year: academicYear }, '-created_date', 5000),
      base44.asServiceRole.entities.StudentFollowUp.filter({ academic_year: academicYear }, '-created_date', 5000),
      base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear })
    ]);

    // Safety: ensure all are arrays
    const safeInvoices = Array.isArray(invoices) ? invoices : [];
    const safePayments = Array.isArray(payments) ? payments : [];
    const safeStudents = Array.isArray(allStudents) ? allStudents : [];
    const safeFollowUps = Array.isArray(followUps) ? followUps : [];
    const safeAcademicYears = Array.isArray(academicYears) ? academicYears : [];

    // Get academic year start date, fallback to April 1st
    let ayStartDate;
    const today = new Date();
    if (safeAcademicYears.length > 0 && safeAcademicYears[0].start_date) {
      ayStartDate = new Date(safeAcademicYears[0].start_date);
    } else {
      const ayParts = academicYear.split('-');
      const startYear = parseInt(ayParts[0]);
      ayStartDate = new Date(startYear, 3, 1); // April 1st
    }

    // Build student lookup
    const studentLookup = {};
    safeStudents.forEach(s => { studentLookup[s.student_id] = s; });

    // Build latest follow-ups map
    const latestFollowUpMap = {};
    safeFollowUps.forEach(fu => {
      if (!latestFollowUpMap[fu.student_id] || new Date(fu.created_date) > new Date(latestFollowUpMap[fu.student_id].created_date)) {
        latestFollowUpMap[fu.student_id] = fu;
      }
    });

    // Build per-student balance using LEDGER-IDENTICAL logic
    const studentDataMap = {};

    const ensure = (studentId, studentName, className_) => {
      if (!studentDataMap[studentId]) {
        studentDataMap[studentId] = {
          studentId,
          studentName: studentName || '',
          className: className_ || '',
          totalDebit: 0,    // invoices + positive adjustments
          totalCredit: 0,   // payments + credits + negative adjustments
          lastPaymentDate: null
        };
      }
      return studentDataMap[studentId];
    };

    // ── INVOICE ROWS (DEBIT) — same as ledger ──
    // Skip Cancelled and Waived (Waived is shown as VOID in ledger = zero effect)
    for (const inv of safeInvoices) {
      if (inv.status === 'Cancelled' || inv.status === 'Waived') continue;
      const net = inv.total_amount ?? 0;
      const row = ensure(inv.student_id, inv.student_name, inv.class_name);
      row.totalDebit += net;
    }

    // ── PAYMENT ROWS — same classification as ledger ──
    const seenIds = new Set();
    for (const p of safePayments) {
      if (seenIds.has(p.id)) continue;
      seenIds.add(p.id);

      const rawStatus = (p.status || '').toUpperCase();
      const isVoid = VOID_STATUSES.has(rawStatus) || VOID_STATUSES.has(p.status);
      if (isVoid) continue; // VOID: excluded (zero financial effect, same as ledger)

      const amount = p.amount_paid ?? 0;
      const isTransportAdj = p.entry_type === 'TRANSPORT_ADJUSTMENT';
      const isHostelAdj = p.entry_type === 'HOSTEL_ADJUSTMENT';
      const isCredit = p.entry_type === 'CREDIT_ADJUSTMENT';

      // Find student ID from payment or linked invoice
      const inv = safeInvoices.find(i => i.id === p.invoice_id);
      const sid = p.student_id || inv?.student_id;
      if (!sid) continue;

      const row = ensure(sid, p.student_name || inv?.student_name, p.class_name || inv?.class_name);

      if (isTransportAdj || isHostelAdj) {
        // Positive = debit (student owes more), Negative = credit (student owes less)
        if (amount > 0) {
          row.totalDebit += Math.abs(amount);
        } else {
          row.totalCredit += Math.abs(amount);
        }
      } else if (isCredit) {
        // Credit adjustment: reduces balance
        row.totalCredit += Math.abs(amount);
      } else {
        // Standard payment: reduces balance
        const contribution = amount < 0 ? 0 : amount; // guard negative
        row.totalCredit += contribution;
        if (p.payment_date && (!row.lastPaymentDate || p.payment_date > row.lastPaymentDate)) {
          row.lastPaymentDate = p.payment_date;
        }
      }
    }

    // Build earliest due_date per student from active invoices
    const studentDueDateMap = {};
    for (const inv of safeInvoices) {
      if (inv.status === 'Cancelled' || inv.status === 'Waived') continue;
      const invDueDate = inv.due_date || null;
      if (!invDueDate) continue;
      if (!studentDueDateMap[inv.student_id] || invDueDate < studentDueDateMap[inv.student_id]) {
        studentDueDateMap[inv.student_id] = invDueDate;
      }
    }

    // Build defaulters list
    const defaultersList = [];

    Object.values(studentDataMap).forEach(studentData => {
      const studentId = studentData.studentId;
      const student = studentLookup[studentId];
      if (!student) return;
      if (student.is_deleted === true) return;
      if (student.is_active === false) return;

      // Apply class/section filter
      if (className && student.class_name !== className) return;
      if (section && student.section !== section) return;

      // Calculate outstanding = debit - credit (same as ledger closing balance)
      const due = Math.max(studentData.totalDebit - studentData.totalCredit, 0);

      // Filter by minDue
      if (due < minDue) return;

      // Calculate days since last payment
      let daysSinceLastPayment;
      if (studentData.lastPaymentDate) {
        const lastPayDate = new Date(studentData.lastPaymentDate);
        daysSinceLastPayment = Math.floor((today - lastPayDate) / (1000 * 60 * 60 * 24));
      } else {
        daysSinceLastPayment = Math.floor((today - ayStartDate) / (1000 * 60 * 60 * 24));
      }

      if (daysSinceLastPaymentMin !== null && daysSinceLastPayment < daysSinceLastPaymentMin) return;

      const latestFU = latestFollowUpMap[studentId];
      if (followUpStatus && latestFU && !followUpStatus.includes(latestFU.status)) return;
      if (followUpStatus && !latestFU && !followUpStatus.includes('NEW')) return;

      if (search) {
        const searchFields = [
          student.name?.toLowerCase() || '',
          student.student_id?.toLowerCase() || '',
          student.parent_phone?.toLowerCase() || ''
        ];
        if (!searchFields.some(f => f.includes(search))) return;
      }

      defaultersList.push({
        student: { id: student.student_id, name: student.name, admissionNo: student.student_id },
        class: { name: student.class_name },
        section: student.section,
        net: studentData.totalDebit,
        paid: studentData.totalCredit,
        due,
        due_date: studentDueDateMap[studentId] || null,
        lastPaymentDate: studentData.lastPaymentDate,
        daysSinceLastPayment,
        phone1: student.parent_phone || null,
        phone2: null,
        latestFollowUp: latestFU ? {
          status: latestFU.status,
          note: latestFU.note,
          next_followup_date: latestFU.next_followup_date,
          updated_at: latestFU.updated_date
        } : null
      });
    });

    // Sort
    defaultersList.sort((a, b) => {
      if (sort === 'due_desc') {
        if (b.due !== a.due) return b.due - a.due;
        return (b.daysSinceLastPayment ?? 0) - (a.daysSinceLastPayment ?? 0);
      }
      return 0;
    });

    const countNeverPaid = defaultersList.filter(d => d.lastPaymentDate === null).length;
    const countNoPayment90Days = defaultersList.filter(d => d.daysSinceLastPayment !== null && d.daysSinceLastPayment >= 90).length;
    const totalDue = defaultersList.reduce((sum, d) => sum + d.due, 0);

    const totalRows = defaultersList.length;
    const rows = defaultersList.slice(skipCount, skipCount + pageSize);

    return Response.json({
      meta: { page, pageSize, total: totalRows, totalPages: Math.ceil(totalRows / pageSize) },
      summary: {
        countStudents: totalRows,
        totalDue,
        avgDue: totalRows > 0 ? Math.round(totalDue / totalRows) : 0,
        countNeverPaid,
        countNoPayment90Days
      },
      rows
    });

  } catch (error) {
    console.error('getDefaultersReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});