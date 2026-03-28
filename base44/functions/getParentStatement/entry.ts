/**
 * Parent Statement Endpoint
 * Returns student's annual fee summary and payment history for a given academic year.
 * Source of truth: invoice.paid_amount (matches ledger, outstanding, and defaulters reports exactly).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};

    const staffInfo = body.staffInfo;
    let user = null;

    if (staffInfo?.staff_id) {
      user = { role: staffInfo.role };
    } else {
      user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (user.role || '').toLowerCase();
    const allowedRoles = ['admin', 'principal', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return Response.json({ error: 'Forbidden: Only Admin/Principal/Accountant can access' }, { status: 403 });
    }

    let studentId, academicYear, includeVoided;

    if (req.method === 'POST') {
      studentId = body.student_id;
      academicYear = body.academic_year;
      includeVoided = body.includeVoided === true || body.includeVoided === 'true';
    } else {
      const params = new URL(req.url).searchParams;
      studentId = params.get('student_id');
      academicYear = params.get('academic_year');
      includeVoided = params.get('includeVoided') === 'true';
    }

    if (!studentId || !academicYear) {
      return Response.json({ error: 'Missing required: student_id, academic_year' }, { status: 400 });
    }

    // Fetch student + invoices + payments in parallel
    const [students, allInvoices, allPayments] = await Promise.all([
      base44.asServiceRole.entities.Student.filter({ student_id: studentId, academic_year: academicYear }),
      base44.asServiceRole.entities.FeeInvoice.filter({ student_id: studentId, academic_year: academicYear }),
      base44.asServiceRole.entities.FeePayment.filter({ student_id: studentId, academic_year: academicYear })
    ]);

    if (!students || students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }
    const student = students[0];

    const annualInvoice = allInvoices.find(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL') || null;
    if (!annualInvoice) {
      return Response.json({ error: 'No annual invoice found for this student' }, { status: 404 });
    }

    // Adhoc (additional fee) invoices — exclude cancelled
    const adhocInvoices = allInvoices.filter(i => i.invoice_type === 'ADHOC' && i.status !== 'Cancelled');

    // ── Source of truth: invoice.paid_amount (matches ledger/outstanding/defaulters) ──
    const annualGross  = annualInvoice.gross_total || annualInvoice.total_amount || 0;
    const adhocGross   = adhocInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const grossTotal   = annualGross + adhocGross;

    const discountTotal = annualInvoice.discount_total || 0;

    // Net = annualInvoice.total_amount (net payable after discount) + all adhoc net amounts
    const annualNet  = annualInvoice.total_amount || 0;
    const netTotal   = annualNet + adhocGross;

    // Use invoice.paid_amount as canonical paid total — same as all other reports
    const annualPaid = annualInvoice.paid_amount || 0;
    const adhocPaid  = adhocInvoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
    const totalPaid  = annualPaid + adhocPaid;

    const balanceDue = Math.max(netTotal - totalPaid, 0);

    // Filter payments for display
    const validPayments = includeVoided
      ? allPayments.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date))
      : allPayments
          .filter(p => p.status !== 'VOID' && p.status !== 'CANCELLED')
          .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    const payments = validPayments.map(p => ({
      date: p.payment_date,
      receiptNo: p.receipt_no,
      mode: p.payment_mode || 'Cash',
      amount: p.amount_paid,
      status: p.status || 'Active'
    }));

    return Response.json({
      student: {
        id: student.student_id,
        name: student.name,
        admissionNo: student.student_id,
        class_name: student.class_name,
        section: student.section
      },
      academicYear,
      summary: {
        gross: grossTotal,
        discount: discountTotal,
        net: netTotal,
        totalPaid,
        balanceDue
      },
      payments
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});