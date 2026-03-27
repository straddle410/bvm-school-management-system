import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { student_ids, due_date, academic_year } = await req.json();

    if (!student_ids || student_ids.length === 0) {
      return Response.json({ error: 'No student IDs provided' }, { status: 400 });
    }
    if (!due_date) {
      return Response.json({ error: 'No due date provided' }, { status: 400 });
    }

    let updated = 0;
    let failed = 0;

    for (const studentId of student_ids) {
      // Find all active invoices for this student (not Cancelled/Waived)
      const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
        student_id: studentId,
        ...(academic_year ? { academic_year } : {})
      });

      const activeInvoices = invoices.filter(inv =>
        !['Cancelled', 'Waived'].includes(inv.status)
      );

      for (const inv of activeInvoices) {
        await base44.asServiceRole.entities.FeeInvoice.update(inv.id, { due_date });
        updated++;
      }

      if (activeInvoices.length === 0) failed++;
    }

    return Response.json({ success: true, updated, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});