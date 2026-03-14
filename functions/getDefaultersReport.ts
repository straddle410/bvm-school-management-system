/**
 * Defaulters Report Endpoint
 * Returns students with outstanding balance (due > 0) sorted by due amount and days since last payment.
 * Uses same truth as Outstanding report (invoice.net, valid payments only, VOID excluded).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    console.log('RAW URL:', req.url);
    
    // Parse request body (base44.functions.invoke sends POST body)
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

    // Fetch data in parallel — same as Outstanding Report
    const [invoices, payments, allStudents, followUps, academicYears] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.Student.filter({ academic_year: academicYear }, '-created_date', 5000),
      base44.asServiceRole.entities.StudentFollowUp.filter({ academic_year: academicYear }, '-created_date', 5000),
      base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear })
    ]);

    // Get academic year start date from database, fallback to April 1st
    let ayStartDate;
    const today = new Date();
    
    if (academicYears.length > 0 && academicYears[0].start_date) {
      ayStartDate = new Date(academicYears[0].start_date);
    } else {
      // Fallback to April 1st
      const ayParts = academicYear.split('-');
      const startYear = parseInt(ayParts[0]);
      ayStartDate = new Date(startYear, 3, 1); // April = month 3 (0-indexed)
    }

    const VOID_STATUSES = new Set(['VOID', 'CANCELLED']);

    // Active invoices: not Cancelled/Waived (same as Outstanding Report)
    const activeInvoices = invoices.filter(inv => {
      const excludedStatuses = new Set(['Cancelled', 'Waived']);
      return !excludedStatuses.has(inv.status);
    });

    // Active payments: EXCLUDE VOID (same as Outstanding Report)
    const activePayments = payments.filter(p => {
      const rawStatus = (p.status || '').toUpperCase();
      return !VOID_STATUSES.has(rawStatus) && !VOID_STATUSES.has(p.status);
    });

    // Build student lookup for enrichment (no filtering - include all students)
    const studentLookup = {};
    allStudents.forEach(s => {
      studentLookup[s.student_id] = s;
    });

    // Build latest follow-ups map (latest per student)
    const latestFollowUpMap = {};
    followUps.forEach(fu => {
      if (!latestFollowUpMap[fu.student_id] || new Date(fu.created_date) > new Date(latestFollowUpMap[fu.student_id].created_date)) {
        latestFollowUpMap[fu.student_id] = fu;
      }
    });

    // Build per-student aggregates (same as Outstanding Report)
    const studentDataMap = {};

    const ensure = (studentId, studentName, className_) => {
      if (!studentDataMap[studentId]) {
        studentDataMap[studentId] = {
          studentId,
          studentName: studentName || '',
          className: className_ || '',
          grossAmount: 0,
          discountAmount: 0,
          netInvoiced: 0,
          paidAmount: 0,
          lastPaymentDate: null
        };
      }
      return studentDataMap[studentId];
    };

    // Aggregate invoices (same as Outstanding Report)
    for (const inv of activeInvoices) {
      const row = ensure(inv.student_id, inv.student_name, inv.class_name);
      const gross = inv.gross_total ?? inv.total_amount ?? 0;
      const discount = inv.discount_total ?? 0;
      const net = inv.total_amount ?? 0;

      row.grossAmount += gross;
      row.discountAmount += discount;
      row.netInvoiced += net;
    }

    // Aggregate payments (same as Outstanding Report)
    for (const p of activePayments) {
      let contribution = 0;

      if (p.entry_type === 'CREDIT_ADJUSTMENT') {
        contribution = p.amount_paid || 0;
      } else {
        contribution = p.amount_paid || 0;
        if (contribution < 0) contribution = 0;
      }

      if (contribution === 0) continue;

      const inv = invoices.find(i => i.id === p.invoice_id);
      const sid = p.student_id || inv?.student_id;
      if (!sid) continue;

      const row = ensure(sid, p.student_name || inv?.student_name, p.class_name || inv?.class_name);
      row.paidAmount += contribution;

      if (p.payment_date && (!row.lastPaymentDate || p.payment_date > row.lastPaymentDate)) {
        row.lastPaymentDate = p.payment_date;
      }
    }

    // Process into defaulters list (build from studentDataMap like Outstanding Report)
    const defaultersList = [];

    Object.values(studentDataMap).forEach(studentData => {
      const studentId = studentData.studentId;
      
      // Enrich with Student entity details (if available and not deleted)
      const student = studentLookup[studentId];
      if (!student) return; // Skip if student not found
      if (student.is_deleted === true) return; // Skip deleted students

      // Apply class/section filter
      if (className && student.class_name !== className) return;
      if (section && student.section !== section) return;

      // Calculate amounts (same as Outstanding Report)
      const grossAmount = studentData.grossAmount || 0;
      const discountAmount = studentData.discountAmount || 0;
      const netInvoiced = studentData.netInvoiced || 0;
      const paidAmount = studentData.paidAmount || 0;
      const latestPaymentDate = studentData.lastPaymentDate || null;

      const rawOutstanding = netInvoiced - paidAmount;
      const due = Math.max(rawOutstanding, 0);

      // Filter by minDue
      if (due < minDue) return;

      // Calculate days since last payment (for display only - no filter)
      let daysSinceLastPayment;
      if (latestPaymentDate) {
        const lastPayDate = new Date(latestPaymentDate);
        daysSinceLastPayment = Math.floor((today - lastPayDate) / (1000 * 60 * 60 * 24));
      } else {
        // Never paid: calculate days since academic year start
        const diffTime = today - ayStartDate;
        daysSinceLastPayment = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      }

      // Build defaulter row
      const latestFU = latestFollowUpMap[studentId];

      // Filter by follow-up status if provided
      if (followUpStatus && latestFU) {
        if (!followUpStatus.includes(latestFU.status)) return;
      }

      // Apply search
      if (search) {
        const searchFields = [
          student.name?.toLowerCase() || '',
          student.student_id?.toLowerCase() || '',
          student.parent_phone?.toLowerCase() || ''
        ];
        if (!searchFields.some(f => f.includes(search))) return;
      }

      defaultersList.push({
        student: {
          id: student.student_id,
          name: student.name,
          admissionNo: student.student_id
        },
        class: {
          name: student.class_name
        },
        section: student.section,
        gross: grossAmount,
        discount: discountAmount,
        net: netInvoiced,
        paid: paidAmount,
        due: due,
        lastPaymentDate: latestPaymentDate,
        daysSinceLastPayment: daysSinceLastPayment,
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
        const aDays = a.daysSinceLastPayment ?? 0;
        const bDays = b.daysSinceLastPayment ?? 0;
        return bDays - aDays;
      }
      return 0;
    });

    // Calculate summary
    const countNeverPaid = defaultersList.filter(d => d.lastPaymentDate === null).length;
    const countNoPayment90Days = defaultersList.filter(d => d.daysSinceLastPayment !== null && d.daysSinceLastPayment >= 90).length;
    const totalDue = defaultersList.reduce((sum, d) => sum + d.due, 0);

    // Paginate
    const totalRows = defaultersList.length;
    const rows = defaultersList.slice(skipCount, skipCount + pageSize);

    return Response.json({
      meta: {
        page: page,
        pageSize: pageSize,
        total: totalRows,
        totalPages: Math.ceil(totalRows / pageSize)
      },
      summary: {
        countStudents: totalRows,
        totalDue: totalDue,
        avgDue: totalRows > 0 ? Math.round(totalDue / totalRows) : 0,
        countNeverPaid: countNeverPaid,
        countNoPayment90Days: countNoPayment90Days
      },
      rows: rows
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});