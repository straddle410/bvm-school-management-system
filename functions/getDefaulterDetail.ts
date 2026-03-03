/**
 * Defaulter Detail Endpoint
 * Returns detailed info for a specific student (invoices, payments, follow-ups).
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

    // Extract studentId and academicYear from URL
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const studentId = pathParts[pathParts.length - 1];
    const academicYear = url.searchParams.get('academicYear') || new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString().slice(-2);
    const includeVoided = url.searchParams.get('includeVoided') === 'true';

    // Fetch data
    const [student, invoices, allPayments, followUps] = await Promise.all([
      base44.asServiceRole.entities.Student.filter({ student_id: studentId, academic_year: academicYear }),
      base44.asServiceRole.entities.FeeInvoice.filter({ student_id: studentId, academic_year: academicYear, invoice_type: 'ANNUAL' }),
      base44.asServiceRole.entities.FeePayment.filter({ student_id: studentId, academic_year: academicYear }),
      base44.asServiceRole.entities.StudentFollowUp.filter({ student_id: studentId, academic_year: academicYear })
    ]);

    if (!student || student.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentRecord = student[0];
    const payments = includeVoided ? allPayments : allPayments.filter(p => p.status !== 'VOID');

    // Aggregate financials
    let totalGross = 0, totalDiscount = 0, totalNet = 0, totalPaid = 0;

    invoices.forEach(inv => {
      totalGross += inv.gross_total || 0;
      totalDiscount += inv.discount_total || 0;
      totalNet += inv.total_amount || 0;
    });

    payments.forEach(p => {
      totalPaid += p.amount_paid || 0;
    });

    const due = Math.max(totalNet - totalPaid, 0);

    return Response.json({
      student: {
        id: studentRecord.student_id,
        name: studentRecord.name,
        admissionNo: studentRecord.student_id,
        className: studentRecord.class_name,
        section: studentRecord.section,
        phone1: studentRecord.parent_phone,
        email: studentRecord.parent_email
      },
      financialSummary: {
        gross: totalGross,
        discount: totalDiscount,
        net: totalNet,
        paid: totalPaid,
        due: due
      },
      invoices: invoices.map(inv => ({
        id: inv.id,
        installment: inv.installment_name,
        dueDate: inv.due_date,
        gross: inv.gross_total,
        discount: inv.discount_total,
        net: inv.total_amount,
        paid: payments.filter(p => p.invoice_id === inv.id).reduce((sum, p) => sum + p.amount_paid, 0),
        status: inv.status
      })),
      payments: payments.map(p => ({
        id: p.id,
        receiptNo: p.receipt_no,
        date: p.payment_date,
        amount: p.amount_paid,
        mode: p.payment_mode,
        status: p.status,
        voided: p.status === 'VOID'
      })),
      followUps: followUps.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)).map(fu => ({
        id: fu.id,
        status: fu.status,
        priority: fu.priority,
        note: fu.note,
        nextFollowUpDate: fu.next_followup_date,
        createdBy: fu.created_by,
        createdAt: fu.created_date
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});