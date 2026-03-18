/**
 * Export Defaulters Report as CSV
 * Uses same filters as getDefaultersReport but returns CSV format.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user.role?.toLowerCase();
    const allowedRoles = ['admin', 'principal', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request parameters (same as getDefaultersReport)
    const params = new URL(req.url).searchParams;
    const academicYear = params.get('academicYear') || new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString().slice(-2);
    const className = params.get('className') || null;
    const section = params.get('section') || null;
    const minDue = parseFloat(params.get('minDue')) || 1;
    const search = params.get('search')?.trim().toLowerCase() || null;

    // Fetch data
    const [invoices, payments, students, followUps] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear, invoice_type: 'ANNUAL' }),
      base44.asServiceRole.entities.FeePayment.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.Student.filter({ academic_year: academicYear, is_deleted: false }),
      base44.asServiceRole.entities.StudentFollowUp.filter({ academic_year: academicYear })
    ]);

    // Build maps
    const studentMap = {};
    students.forEach(s => {
      studentMap[s.student_id] = s;
    });

    const paymentsByInvoice = {};
    payments.forEach(p => {
      if (p.status !== 'VOID') {
        if (!paymentsByInvoice[p.invoice_id]) {
          paymentsByInvoice[p.invoice_id] = [];
        }
        paymentsByInvoice[p.invoice_id].push(p);
      }
    });

    const latestFollowUpMap = {};
    followUps.forEach(fu => {
      if (!latestFollowUpMap[fu.student_id] || new Date(fu.created_date) > new Date(latestFollowUpMap[fu.student_id].created_date)) {
        latestFollowUpMap[fu.student_id] = fu;
      }
    });

    // Process defaulters
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

      if (className && student.class_name !== className) return;
      if (section && student.section !== section) return;

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
      if (due < minDue) return;

      let daysSinceLastPayment = null;
      if (latestPaymentDate) {
        const lastPayDate = new Date(latestPaymentDate);
        const today = new Date();
        daysSinceLastPayment = Math.floor((today - lastPayDate) / (1000 * 60 * 60 * 24));
      }

      if (search) {
        const searchFields = [
          student.name?.toLowerCase() || '',
          student.student_id?.toLowerCase() || '',
          student.parent_phone?.toLowerCase() || ''
        ];
        if (!searchFields.some(f => f.includes(search))) return;
      }

      const latestFU = latestFollowUpMap[studentId];

      defaultersList.push({
        student: student.name,
        admissionNo: student.student_id,
        class: student.class_name,
        due: due.toFixed(2),
        lastPaymentDate: latestPaymentDate || 'Never Paid',
        daysSinceLastPayment: daysSinceLastPayment !== null ? daysSinceLastPayment : 'N/A',
        phone1: student.parent_phone || '',
        phone2: '',
        latestStatus: latestFU?.status || '',
        latestNote: latestFU?.note || '',
        nextFollowUpDate: latestFU?.next_followup_date || ''
      });
    });

    // Generate CSV
    const headers = ['Student', 'Admission No', 'Class', 'Due (₹)', 'Last Payment', 'Days Since', 'Phone 1', 'Phone 2', 'Follow-up Status', 'Latest Note', 'Next Follow-up'];
    const csvRows = [headers.map(h => `"${h}"`).join(',')];

    defaultersList.forEach(row => {
      const csvRow = [
        `"${row.student}"`,
        `"${row.admissionNo}"`,
        `"${row.class}"`,
        row.due,
        `"${row.lastPaymentDate}"`,
        row.daysSinceLastPayment,
        `"${row.phone1}"`,
        `"${row.phone2}"`,
        `"${row.latestStatus}"`,
        `"${row.latestNote.replace(/"/g, '""')}"`,
        `"${row.nextFollowUpDate}"`
      ].join(',');
      csvRows.push(csvRow);
    });

    const csv = csvRows.join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="defaulters_${academicYear}_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});