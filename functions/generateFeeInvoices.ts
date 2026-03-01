import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'Admin' && user.role !== 'principal' && user.role !== 'Principal') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { feePlanId, installmentName, academicYear, className } = await req.json();
    if (!feePlanId || !installmentName || !academicYear || !className) {
      return Response.json({ error: 'feePlanId, installmentName, academicYear and className are required' }, { status: 400 });
    }

    // Load fee plan
    const plans = await base44.asServiceRole.entities.FeePlan.filter({ id: feePlanId });
    if (!plans || plans.length === 0) return Response.json({ error: 'Fee plan not found' }, { status: 404 });
    const plan = plans[0];

    // Guard: plan must match academicYear
    if (plan.academic_year !== academicYear) {
      return Response.json({ error: `Plan academic year (${plan.academic_year}) does not match context (${academicYear})` }, { status: 422 });
    }

    const installment = (plan.installments || []).find(i => i.name === installmentName);
    if (!installment) return Response.json({ error: `Installment "${installmentName}" not found in plan` }, { status: 404 });

    // Load published students for this class + academic year
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: className,
      academic_year: academicYear,
      status: 'Published'
    });

    if (students.length === 0) return Response.json({ created: 0, skipped: 0, message: 'No published students found' });

    let created = 0, skipped = 0;
    for (const student of students) {
      // Student academic_year guard
      if (student.academic_year && student.academic_year !== academicYear) {
        skipped++;
        continue;
      }

      // Check for duplicate invoice
      const existing = await base44.asServiceRole.entities.FeeInvoice.filter({
        student_id: student.student_id,
        academic_year: academicYear,
        installment_name: installmentName
      });
      if (existing && existing.length > 0) { skipped++; continue; }

      await base44.asServiceRole.entities.FeeInvoice.create({
        academic_year: academicYear,
        student_id: student.student_id,
        student_name: student.name,
        class_name: student.class_name,
        section: student.section,
        installment_name: installmentName,
        due_date: installment.due_date || '',
        fee_heads: installment.fee_heads || [],
        total_amount: installment.total_amount || 0,
        paid_amount: 0,
        balance: installment.total_amount || 0,
        status: 'Pending',
        generated_by: user.email
      });
      created++;
    }

    return Response.json({ success: true, created, skipped, total: students.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});