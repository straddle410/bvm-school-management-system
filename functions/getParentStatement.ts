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

    // Fetch annual invoice
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      student_id: studentId,
      academic_year: academicYear,
      invoice_type: 'ANNUAL'
    });

    if (!invoices || invoices.length === 0) {
      return Response.json({ error: 'No annual invoice found for this student' }, { status: 404 });
    }

    const invoice = invoices[0];

    // Fetch payments
    const allPayments = await base44.asServiceRole.entities.FeePayment.filter({
      student_id: studentId,
      academic_year: academicYear
    });

    // Filter payments
    const validPayments = includeVoided 
      ? allPayments.sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date))
      : allPayments.filter(p => p.status !== 'VOID' && p.status !== 'CANCELLED')
          .sort((a, b) => new Date(a.payment_date) - new Date(b.payment_date));

    // Calculate totals (valid only, never count VOID)
    let totalPaid = 0;
    allPayments.forEach(p => {
      if (p.status !== 'VOID' && p.status !== 'CANCELLED') {
        totalPaid += p.amount_paid || 0;
      }
    });

    const net = invoice.total_amount || 0;
    const balanceDue = Math.max(net - totalPaid, 0);

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
        gross: invoice.gross_total || 0,
        discount: invoice.discount_total || 0,
        net: net,
        totalPaid: totalPaid,
        balanceDue: balanceDue
      },
      payments: payments
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});