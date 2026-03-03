import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const VOID_STATUSES = new Set(['VOID', 'CANCELLED', 'REVERSED']);

    // Fetch all payments (we need to filter client-side as SDK may not support $lt)
    const allPayments = await base44.asServiceRole.entities.FeePayment.list();

    const targets = allPayments.filter(p => {
      const amt = p.amount_paid ?? 0;
      const status = (p.status || '').toUpperCase();
      return amt < 0 && !VOID_STATUSES.has(status);
    });

    if (targets.length === 0) {
      return Response.json({ message: 'No legacy negative payments found. Nothing to clean up.', updated: 0, ids: [] });
    }

    const now = new Date().toISOString();
    const updatedIds = [];

    for (const p of targets) {
      await base44.asServiceRole.entities.FeePayment.update(p.id, {
        status: 'VOID',
        void_reason: 'Legacy negative test entry cleanup',
        voided_at: now,
        voided_by: 'system'
      });
      updatedIds.push(p.id);
    }

    return Response.json({
      message: `Cleanup complete. Marked ${updatedIds.length} legacy negative payment(s) as VOID.`,
      updated: updatedIds.length,
      ids: updatedIds
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});