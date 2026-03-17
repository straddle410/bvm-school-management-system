import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(user?.role || '').trim().toLowerCase();
    if (!['admin', 'principal'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { cardIds } = await req.json();

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return Response.json({ error: 'cardIds array is required' }, { status: 400 });
    }

    let deletedCount = 0;
    const errors = [];

    for (const id of cardIds) {
      try {
        await base44.asServiceRole.entities.ProgressCard.delete(id);
        deletedCount++;
      } catch (error) {
        errors.push({ id, error: error.message });
        console.error(`Failed to delete card ${id}: ${error.message}`);
      }
    }

    return Response.json({
      message: `Deleted ${deletedCount} of ${cardIds.length} progress cards`,
      deletedCount,
      errors
    });
  } catch (error) {
    console.error('Delete progress cards error:', error);
    return Response.json({ error: error.message || 'Delete failed' }, { status: 500 });
  }
});