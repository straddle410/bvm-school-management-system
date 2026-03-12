import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - admin only' }, { status: 403 });
    }

    // Fetch all marks with 'Approved' or 'Verified' status
    const approvedMarks = await base44.asServiceRole.entities.Marks.filter({
      status: 'Approved'
    });

    const verifiedMarks = await base44.asServiceRole.entities.Marks.filter({
      status: 'Verified'
    });

    const allMarksToUpdate = [...approvedMarks, ...verifiedMarks];

    if (allMarksToUpdate.length === 0) {
      return Response.json({
        success: true,
        message: 'No marks with Approved or Verified status found',
        updatedCount: 0
      });
    }

    // Update all marks to Draft status in batches
    const BATCH_SIZE = 50;
    let updatedCount = 0;

    for (let i = 0; i < allMarksToUpdate.length; i += BATCH_SIZE) {
      const batch = allMarksToUpdate.slice(i, i + BATCH_SIZE);
      const updatePromises = batch.map(mark =>
        base44.asServiceRole.entities.Marks.update(mark.id, {
          status: 'Draft'
        })
      );

      await Promise.all(updatePromises);
      updatedCount += batch.length;
    }

    return Response.json({
      success: true,
      message: `Successfully reverted ${updatedCount} marks from Approved/Verified to Draft`,
      updatedCount
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});