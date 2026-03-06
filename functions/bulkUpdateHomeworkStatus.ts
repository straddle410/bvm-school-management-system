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

    // Check if user is admin/principal (can update any homework)
    const userRole = (user.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';

    // If not admin, fetch homework items to verify ownership
    let accessibleIds = homework_ids;
    if (!isAdmin) {
      // Teacher/Staff can only update their own homework
      const homeworkItems = await base44.asServiceRole.entities.Homework.filter(
        { id: { $in: homework_ids } },
        'id',
        500
      );
      
      // Filter to only homework where assigned_by matches user.name
      accessibleIds = homeworkItems
        .filter(hw => hw.assigned_by === user.name)
        .map(hw => hw.id);
      
      if (accessibleIds.length === 0) {
        return Response.json({ 
          error: 'FORBIDDEN: You cannot update any of the selected homework',
          updated_count: 0,
          skipped_count: homework_ids.length
        }, { status: 403 });
      }
    }

    // Update accessible homework items only
    let updatedCount = 0;
    for (const hwId of accessibleIds) {
      await base44.asServiceRole.entities.Homework.update(hwId, { status });
      updatedCount++;
    }

    const skippedCount = homework_ids.length - accessibleIds.length;

    console.log('[BULK_HW_UPDATE]', {
      user: user.email,
      user_role: userRole,
      total_requested: homework_ids.length,
      updated: updatedCount,
      skipped: skippedCount,
      status,
    });

    return Response.json({ 
      updated_count: updatedCount, 
      skipped_count: skippedCount,
      status 
    });
  } catch (error) {
    console.error('[bulkUpdateHomeworkStatus]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});