/**
 * Parent Statement Endpoint
 * Returns student's annual fee summary and payment history for a given academic year.
 * Used for generating printable parent statements.
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
      return Response.json({ error: 'Forbidden: Only Admin/Principal/Accountant can access' }, { status: 403 });
    }

    // Parse request
    let studentId, academicYear, includeVoided;
    
    if (req.method === 'POST') {
      const body = await req.json();
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

    // Fetch student
    const students = await base44.asServiceRole.entities.Student.filter({
      student_id: studentId,
      academic_year: academicYear
    });

    if (!students || students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = students[0];

    // Fetch ALL invoices for this student/year (ANNUAL + ADHOC)
    const allInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      student_id: studentId,
      academic_year: academicYear
    });

    const annualInvoice = allInvoices.find(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL') || null;

    if (!annualInvoice) {
      return Response.json({ error: 'No annual invoice found for this student' }, { status: 404 });
    }

    // Adhoc (additional fee) invoices — exclude cancelled
    const adhocInvoices = allInvoices.filter(i => i.invoice_type === 'ADHOC' && i.status !== 'Cancelled');

    // Fetch ALL payments for the academic year (ANNUAL + ADHOC)
    const allPayments = await base44.asServiceRole.entities.FeePayment.filter({
      student_id: studentId,
      academic_year: academicYear
    });

    // Filter payments for display
    const validPayments = includeVoided
      ? allPayments.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date))
      : allPayments.filter(p => p.status !== 'VOID' && p.status !== 'CANCELLED')
          .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    // Calculate total paid (cash only): excludes TRANSPORT_ADJUSTMENT entries
    let totalPaid = 0;
    // Track transport adjustments separately (they affect balance but not cash)
    let transportAdjustmentTotal = 0;
    allPayments.forEach(p => {
      if (p.status === 'VOID' || p.status === 'CANCELLED' || p.is_reversed) return;
      if (p.entry_type === 'TRANSPORT_ADJUSTMENT') {
        // Positive = extra charge (increases balance), negative = credit (reduces balance)
        transportAdjustmentTotal += p.amount_paid || 0;
        return;
      }
      totalPaid += p.amount_paid || 0;
    });

    // ── Correct summary calculation (matches on-screen ledger) ──
    // Gross = Annual invoice gross + sum of adhoc invoice amounts
    const annualGross = annualInvoice.gross_total || annualInvoice.total_amount || 0;
    const adhocGross  = adhocInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
    const grossTotal  = annualGross + adhocGross;

    const discountTotal = annualInvoice.discount_total || 0;
    // Transport adjustments (for locked invoices) modify the effective net total
    const netTotal      = grossTotal - discountTotal + transportAdjustmentTotal;
    const balanceDue    = Math.max(netTotal - totalPaid, 0);

    // Build payment records
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
        class: student.class_name,
        section: student.section
      },
      academicYear: academicYear,
      summary: {
        gross: grossTotal,
        discount: discountTotal,
        net: netTotal,
        totalPaid: totalPaid,
        balanceDue: balanceDue
      },
      payments: payments
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});