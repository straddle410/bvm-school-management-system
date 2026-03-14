/**
 * Defaulters Report Endpoint
 * Returns students with outstanding balance (due > 0) sorted by due amount and days since last payment.
 * Uses same truth as Outstanding report (invoice.net, valid payments only, VOID excluded).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Parse request parameters
    const params = new URL(req.url).searchParams;
    const academicYear = params.get('academicYear') || new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString().slice(-2);
    const className = params.get('className') || null;
    console.log('className filter value:', className);
    const section = params.get('section') || null;
    const minDue = parseFloat(params.get('minDue')) || 1;
    const daysSinceLastPaymentMinParam = params.get('daysSinceLastPaymentMin');
    const daysSinceLastPaymentMin = daysSinceLastPaymentMinParam !== null && daysSinceLastPaymentMinParam !== '' ? parseInt(daysSinceLastPaymentMinParam) : null;
    const followUpStatus = params.get('status') ? params.get('status').split(',') : null;
    const search = params.get('search')?.trim().toLowerCase() || null;
    const sort = params.get('sort') || 'due_desc';
    const page = parseInt(params.get('page')) || 1;
    const pageSize = parseInt(params.get('pageSize')) || 50;
    const skipCount = (page - 1) * pageSize;

    // Fetch data in parallel — global filter: status=Published, is_deleted=false, current AY
    const [invoices, payments, students, followUps] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear, invoice_type: 'ANNUAL' }),
      base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.Student.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.StudentFollowUp.filter({ academic_year: academicYear })
    ]);

    console.log('Academic year used:', academicYear);
    console.log('Students fetched:', students.length);
    console.log('First student sample:', students[0]);

    // Build student map
    const studentMap = {};
    students.forEach(s => {
      studentMap[s.student_id] = s;
    });

    console.log('Total students in map:', Object.keys(studentMap).length);
    console.log('Sample student class_names:', Object.values(studentMap).slice(0,5).map(s => s.class_name));

    // Build payments map (exclude VOID)
    const paymentsByInvoice = {};
    payments.forEach(p => {
      if (p.status !== 'VOID') {
        if (!paymentsByInvoice[p.invoice_id]) {
          paymentsByInvoice[p.invoice_id] = [];
        }
        paymentsByInvoice[p.invoice_id].push(p);
      }
    });

    // Build latest follow-ups map (latest per student)
    const latestFollowUpMap = {};
    followUps.forEach(fu => {
      if (!latestFollowUpMap[fu.student_id] || new Date(fu.created_date) > new Date(latestFollowUpMap[fu.student_id].created_date)) {
        latestFollowUpMap[fu.student_id] = fu;
      }
    });

    // Process invoices into defaulters list
    const defaultersList = [];
    const invoicesByStudent = {};

    invoices.forEach(inv => {
      if (!invoicesByStudent[inv.student_id]) {
        invoicesByStudent[inv.student_id] = [];
      }
      invoicesByStudent[inv.student_id].push(inv);
    });

    Object.entries(invoicesByStudent).forEach(([studentId, studentInvoices]) => {
      const student = studentMap[studentId];
      if (!student) return;

      console.log('Checking student:', student?.class_name, 'vs filter:', className);

      // Apply class/section filter
      if (className && student.class_name !== className) return;
      if (section && student.section !== section) return;

      // Aggregate invoices
      let totalGross = 0, totalDiscount = 0, totalNet = 0, totalPaid = 0;
      let latestPaymentDate = null;

      studentInvoices.forEach(inv => {
        totalGross += inv.gross_total || 0;
        totalDiscount += inv.discount_total || 0;
        totalNet += inv.total_amount || 0;

        const invPayments = paymentsByInvoice[inv.id] || [];
        invPayments.forEach(p => {
          totalPaid += p.amount_paid || 0;
          if (!latestPaymentDate || new Date(p.payment_date) > new Date(latestPaymentDate)) {
            latestPaymentDate = p.payment_date;
          }
        });
      });

      const due = Math.max(totalNet - totalPaid, 0);

      // Filter by minDue
      if (due < minDue) return;

      // Calculate days since last payment
      let daysSinceLastPayment = null;
      if (latestPaymentDate) {
        const lastPayDate = new Date(latestPaymentDate);
        const today = new Date();
        daysSinceLastPayment = Math.floor((today - lastPayDate) / (1000 * 60 * 60 * 24));
      }

      // Filter by daysSinceLastPaymentMin
      if (daysSinceLastPaymentMin !== null) {
        if (daysSinceLastPayment === null || daysSinceLastPayment < daysSinceLastPaymentMin) return;
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
        gross: totalGross,
        discount: totalDiscount,
        net: totalNet,
        paid: totalPaid,
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