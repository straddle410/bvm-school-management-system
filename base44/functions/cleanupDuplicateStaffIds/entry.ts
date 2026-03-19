import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin-only operation
    if (user?.role !== 'admin' && user?.role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { target_username, keep_id } = body;

    if (!target_username) {
      return Response.json({ error: 'target_username is required' }, { status: 400 });
    }

    // Fetch all staff with this username
    const allStaff = await base44.asServiceRole.entities.StaffAccount.filter({
      username: target_username
    });

    if (allStaff.length <= 1) {
      return Response.json({
        success: true,
        message: 'No duplicates found',
        count: 0
      });
    }

    // Determine which record to keep (default: oldest/first)
    const recordToKeep = keep_id ? allStaff.find(s => s.id === keep_id) : allStaff[0];
    if (!recordToKeep) {
      return Response.json({ error: 'Keep record not found' }, { status: 400 });
    }

    // Delete all others
    const toDelete = allStaff.filter(s => s.id !== recordToKeep.id);
    let deletedCount = 0;

    for (const staff of toDelete) {
      try {
        await base44.asServiceRole.entities.StaffAccount.delete(staff.id);
        deletedCount++;
      } catch (err) {
        console.error(`Failed to delete ${staff.id}:`, err);
      }
    }

    return Response.json({
      success: true,
      message: `Cleaned up ${deletedCount} duplicate records for ${target_username}`,
      kept: recordToKeep.id,
      deleted_count: deletedCount,
      total_duplicates: allStaff.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});