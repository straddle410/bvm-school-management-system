import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin or Principal required' }, { status: 403 });
    }

    const { chargeId } = await req.json();
    if (!chargeId) return Response.json({ error: 'chargeId is required' }, { status: 400 });

    // Load charge
    const charges = await base44.asServiceRole.entities.AdditionalCharge.filter({ id: chargeId });
    if (!charges || charges.length === 0) return Response.json({ error: 'Charge not found' }, { status: 404 });
    const charge = charges[0];

    if (charge.status !== 'DRAFT') {
      return Response.json({ error: `Charge is already ${charge.status}. Only DRAFT charges can be published.` }, { status: 422 });
    }

    // Determine target students
    let students = [];
    if (charge.applies_to === 'CLASS') {
      students = await base44.asServiceRole.entities.Student.filter({
        class_name: charge.class_name,
        academic_year: charge.academic_year,
        status: 'Published'
      });
    } else {
      // SELECTED
      const ids = charge.student_ids || [];
      if (ids.length === 0) return Response.json({ error: 'No students selected for this charge.' }, { status: 422 });
      const all = await base44.asServiceRole.entities.Student.filter({
        class_name: charge.class_name,
        academic_year: charge.academic_year,
        status: 'Published'
      });
      students = all.filter(s => ids.includes(s.student_id));
    }

    if (students.length === 0) {
      return Response.json({ error: 'No eligible students found for this charge.' }, { status: 422 });
    }

    // Load existing ADHOC invoices for this charge to avoid duplicates
    const existingInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      charge_id: chargeId,
      academic_year: charge.academic_year
    });
    const alreadyCreatedIds = new Set(existingInvoices.map(inv => inv.student_id));

    let created = 0;
    let skipped = 0;

    for (const student of students) {
      if (alreadyCreatedIds.has(student.student_id)) {
        skipped++;
        continue;
      }

      await base44.asServiceRole.entities.FeeInvoice.create({
        academic_year: charge.academic_year,
        student_id: student.student_id,
        student_name: student.name,
        class_name: student.class_name,
        section: student.section || 'A',
        installment_name: charge.title,
        invoice_type: 'ADHOC',
        charge_id: chargeId,
        title: charge.title,
        fee_heads: [
          {
            fee_head_id: charge.fee_head_id || '',
            fee_head_name: charge.fee_head_name || 'Additional Fee',
            gross_amount: charge.amount,
            discount_amount: 0,
            net_amount: charge.amount,
            amount: charge.amount
          }
        ],
        gross_total: charge.amount,
        discount_total: 0,
        total_amount: charge.amount,
        paid_amount: 0,
        balance: charge.amount,
        status: 'Pending',
        generated_by: user.email
      });
      created++;
    }

    // Mark charge as published
    await base44.asServiceRole.entities.AdditionalCharge.update(chargeId, {
      status: 'PUBLISHED',
      published_at: new Date().toISOString(),
      invoices_created: created
    });

    return Response.json({ success: true, created, skipped, total: students.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});