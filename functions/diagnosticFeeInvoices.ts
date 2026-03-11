import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const staffSession = JSON.parse(req.headers.get('X-Staff-Session') || '{}');
    const userRole = (staffSession.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { className, academicYear } = await req.json();
    if (!className || !academicYear) {
      return Response.json({ error: 'className and academicYear required' }, { status: 400 });
    }

    // Get current FeePlan for this class/year
    const currentPlans = await base44.asServiceRole.entities.FeePlan.filter({
      class_name: className,
      academic_year: academicYear
    });
    const currentPlan = currentPlans[0] || null;

    // Get all annual invoices for this class/year
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      class_name: className,
      academic_year: academicYear,
      invoice_type: 'ANNUAL'
    });

    // For each invoice, extract plan source and breakdown
    const diagnosis = invoices.map(inv => {
      const tuitionLine = (inv.fee_heads || []).find(fh => fh.fee_head_name?.toLowerCase().includes('tuition'));
      return {
        student_id: inv.student_id,
        student_name: inv.student_name,
        gross_total: inv.gross_total,
        discount_total: inv.discount_total || 0,
        net_total: inv.total_amount,
        tuition_gross: tuitionLine?.gross_amount || null,
        tuition_net: tuitionLine?.net_amount || null,
        created_at: inv.created_date,
        discount_snapshot: inv.discount_snapshot || null
      };
    });

    return Response.json({
      success: true,
      class_name: className,
      academic_year: academicYear,
      current_plan: currentPlan ? {
        id: currentPlan.id,
        total_amount: currentPlan.total_amount,
        fee_items: currentPlan.fee_items
      } : null,
      invoices_count: invoices.length,
      invoices: diagnosis
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});