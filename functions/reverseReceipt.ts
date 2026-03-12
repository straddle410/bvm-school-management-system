/**
 * DEPRECATED ALIAS: Use voidReceipt instead.
 * This function is kept for backward compatibility.
 * It delegates to voidReceipt internally.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Parse request body
    const { paymentId, reason, staffInfo } = await req.json();
    if (!paymentId) return Response.json({ error: 'paymentId is required' }, { status: 400 });
    if (!reason?.trim()) return Response.json({ error: 'Void reason is required' }, { status: 400 });

    // Delegate to canonical voidReceipt function
    const res = await base44.asServiceRole.functions.invoke('voidReceipt', {
      paymentId,
      reason: reason.trim(),
      staffInfo
    });

    return Response.json(res.data);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});