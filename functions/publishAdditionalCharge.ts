import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'principal'].includes(user.role?.toLowerCase())) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { chargeId } = await req.json();
    if (!chargeId) return Response.json({ error: 'chargeId is required' }, { status: 400 });

    const charge = await base44.asServiceRole.entities.AdditionalCharge.get(chargeId);
    if (!charge) return Response.json({ error: 'Charge not found' }, { status: 404 });
    if (charge.status !== 'DRAFT') return Response.json({ error: 'Only DRAFT charges can be published' }, { status: 422 });

    // ── ARCHIVE CHECK: Block mutations on archived years ──────────────────────
    const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ year: charge.academic_year });
    if (academicYears && academicYears.length > 0) {
     const ayRecord = academicYears[0];
     if (ayRecord.status === 'Archived' || ayRecord.is_locked) {
       return Response.json({
         error: `Academic year ${charge.academic_year} is archived; mutations not allowed`,
         status: 403
       }, { status: 403 });
     }
    }
    // ──────────────────────────────────────────────────────────────────────

    // Get target students
    let students = [];
    if (charge.applies_to === 'SELECTED') {
      if (!charge.student_ids || charge.student_ids.length === 0) {
        return Response.json({ error: 'No students selected' }, { status: 400 });
      }
      // Fetch each student
      const results = await Promise.all(
        charge.student_ids.map(sid =>
          base44.asServiceRole.entities.Student.filter({ student_id: sid, academic_year: charge.academic_year })
        )
      );
      students = results.flat();
    } else {
      // CLASS — all published students in that class/year
      students = await base44.asServiceRole.entities.Student.filter({
        class_name: charge.class_name,
        academic_year: charge.academic_year,
        status: 'Published'
      });
    }

    if (students.length === 0) {
      return Response.json({ error: 'No eligible students found' }, { status: 400 });
    }

    // Fetch existing ADHOC invoices for this charge (dedup guard)
    const existingInvoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      charge_id: chargeId,
      academic_year: charge.academic_year
    });
    const alreadyHasInvoice = new Set(existingInvoices.map(inv => inv.student_id));

    let created = 0;
    let skipped = 0;

    for (const student of students) {
      if (alreadyHasInvoice.has(student.student_id)) {
        skipped++;
        continue;
      }

      await base44.asServiceRole.entities.FeeInvoice.create({
        academic_year: charge.academic_year,
        student_id: student.student_id,
        student_name: student.name,
        class_name: student.class_name,
        section: student.section,
        installment_name: charge.title,
        title: charge.title,
        invoice_type: 'ADHOC',
        charge_id: chargeId,
        fee_heads: [{
          fee_head_id: charge.fee_head_id,
          fee_head_name: charge.fee_head_name,
          gross_amount: charge.amount,
          discount_amount: 0,
          net_amount: charge.amount,
          amount: charge.amount
        }],
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

    // Update charge status and counts
    await base44.asServiceRole.entities.AdditionalCharge.update(chargeId, {
      status: 'PUBLISHED',
      invoices_created: created,
      invoices_skipped: skipped
    });

    return Response.json({ success: true, created, skipped });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});