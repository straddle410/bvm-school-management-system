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

    const body = await req.json();
    let { cardIds, deleteAll } = body;

    if (deleteAll) {
      // Fetch all progress card IDs
      const allCards = await base44.asServiceRole.entities.ProgressCard.list();
      cardIds = allCards.map(c => c.id);
    }

    if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
      return Response.json({ error: 'cardIds array is required', deletedCount: 0 }, { status: 400 });
    }

    let deletedCount = 0;
    const errors = [];

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    for (const id of cardIds) {
      try {
        await base44.asServiceRole.entities.ProgressCard.delete(id);
        deletedCount++;
        await sleep(300); // avoid rate limiting
      } catch (error) {
        if (error.message?.includes('Rate limit')) {
          // Wait longer and retry up to 3 times
          let retrySuccess = false;
          for (let attempt = 1; attempt <= 3; attempt++) {
            await sleep(2000 * attempt);
            try {
              await base44.asServiceRole.entities.ProgressCard.delete(id);
              deletedCount++;
              retrySuccess = true;
              break;
            } catch (retryError) {
              if (!retryError.message?.includes('Rate limit')) {
                if (retryError.message?.includes('not found')) {
                  deletedCount++;
                  retrySuccess = true;
                }
                break;
              }
            }
          }
          if (!retrySuccess) {
            errors.push({ id, error: 'Rate limit exceeded after 3 retries' });
            console.error(`Failed to delete card ${id} after 3 retries`);
          }
        } else if (error.message?.includes('not found')) {
          // Already deleted — count as success
          deletedCount++;
        } else {
          errors.push({ id, error: error.message });
          console.error(`Failed to delete card ${id}: ${error.message}`);
        }
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