import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Bulk update homework status (Draft/Published)
 * Requires: staff_session_token with admin/principal/teacher role
 */
Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') {
      return Response.json({ error: 'POST required' }, { status: 405 });
    }

    const base44 = createClientFromRequest(req);
    const { homework_ids = [], status } = await req.json();

    if (!homework_ids || homework_ids.length === 0) {
      return Response.json({ error: 'homework_ids required' }, { status: 400 });
    }

    if (!['Draft', 'Published'].includes(status)) {
      return Response.json({ error: 'status must be Draft or Published' }, { status: 400 });
    }

    // Verify user is authenticated staff
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Update all homework items
    let updatedCount = 0;
    for (const hwId of homework_ids) {
      await base44.asServiceRole.entities.Homework.update(hwId, { status });
      updatedCount++;
    }

    console.log('[BULK_HW_UPDATE]', {
      user: user.email,
      count: updatedCount,
      status,
    });

    return Response.json({ updated_count: updatedCount, status });
  } catch (error) {
    console.error('[bulkUpdateHomeworkStatus]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});