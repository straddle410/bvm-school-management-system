import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    // Only process create events
    if (event.type !== 'create') {
      return Response.json({ success: true, message: 'Not a create event' });
    }

    const payment = data;
    const receiptNo = payment.receipt_no;

    if (!receiptNo) {
      console.log('[sendFeePaymentNotification] No receipt_no, skipping');
      return Response.json({ success: true, message: 'No receipt_no' });
    }

    // Deduplication check using Message entity
    const existing = await base44.asServiceRole.entities.Message.filter({
      context_type: 'fee_payment',
      context_id: receiptNo,
    });
    if (existing.length > 0) {
      console.log('[sendFeePaymentNotification] Duplicate skipped for receipt:', receiptNo);
      return Response.json({ success: true, message: 'Duplicate prevented' });
    }

    // Lookup student
    const studentId = payment.student_id;
    let student = null;
    if (studentId) {
      const results = await base44.asServiceRole.entities.Student.filter({ student_id: studentId });
      student = results[0];
    }
    if (!student) {
      const results = await base44.asServiceRole.entities.Student.filter({ id: studentId });
      student = results[0];
    }
    if (!student) {
      console.error('[sendFeePaymentNotification] Student not found:', studentId);
      return Response.json({ success: false, error: 'Student not found' });
    }

    const amountStr = payment.amount_paid ? `₹${Number(payment.amount_paid).toLocaleString()}` : '';
    const subject = '✅ Fee Payment Received';
    const body = `Payment of ${amountStr} received. Receipt: ${receiptNo}`;
    const receiptUrl = `/StudentDashboard?openFees=1&receiptNo=${receiptNo}`;
    const academicYear = payment.academic_year || student.academic_year || '2024-25';

    // Create Message entity (serves as dedup record + in-app notification)
    await base44.asServiceRole.entities.Message.create({
      sender_id: 'system',
      sender_name: 'School',
      sender_role: 'admin',
      recipient_type: 'individual',
      recipient_id: student.student_id,
      recipient_name: student.name,
      subject,
      body,
      is_read: false,
      academic_year: academicYear,
      context_type: 'fee_payment',
      context_id: receiptNo,
    });

    // Send push via centralized function
    try {
      await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
        student_ids: [student.student_id],
        title: subject,
        message: body,
        receipt_no: receiptNo,
      });
      console.log('[sendFeePaymentNotification] Push sent for student:', student.student_id);
    } catch (pushErr) {
      console.warn('[sendFeePaymentNotification] Push failed (non-fatal):', pushErr.message);
    }

    return Response.json({ success: true, receipt_no: receiptNo, student_id: student.student_id });
  } catch (error) {
    console.error('[sendFeePaymentNotification] Error:', error.message);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});