/**
 * Migration: Update all FeePayment records with status='REVERSED' to 'VOID'
 * Also migrate fields: reversal_reason → void_reason, reversed_by → voided_by, reversed_at → voided_at
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
    const isAdmin = ['admin', 'principal'].includes(userRole);
    if (!isAdmin) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all payments with REVERSED status
    const reversedPayments = await base44.asServiceRole.entities.FeePayment.filter({ status: 'REVERSED' });

    let migratedCount = 0;
    const updates = [];

    for (const p of reversedPayments) {
      const updateData = {
        status: 'VOID',
        void_reason: p.reversal_reason || null,
        voided_by: p.reversed_by || null,
        voided_at: p.reversed_at || null
      };

      updates.push(
        base44.asServiceRole.entities.FeePayment.update(p.id, updateData)
          .then(() => { migratedCount++; })
          .catch(err => {
            console.error(`Failed to migrate payment ${p.id}:`, err.message);
          })
      );
    }

    await Promise.all(updates);

    // Verify no REVERSED records remain
    const remaining = await base44.asServiceRole.entities.FeePayment.filter({ status: 'REVERSED' });

    return Response.json({
      success: true,
      migratedCount,
      processedTotal: reversedPayments.length,
      remainingReversedCount: remaining.length,
      confirmation: remaining.length === 0 ? 'All REVERSED records successfully migrated to VOID' : 'WARNING: Some records still have REVERSED status'
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});