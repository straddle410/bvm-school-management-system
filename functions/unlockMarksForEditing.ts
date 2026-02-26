import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const { marksIds } = await req.json();

    if (!marksIds || !Array.isArray(marksIds) || marksIds.length === 0) {
      return Response.json({ error: 'marksIds array required' }, { status: 400 });
    }

    // Fetch marks to verify they're submitted
    const marksFilter = { $in: ['Submitted', 'Verified', 'Approved'] };
    const allMarks = await base44.asServiceRole.entities.Marks.list();
    const marksToUnlock = allMarks.filter(m =>
      marksIds.includes(m.id) &&
      ['Submitted', 'Verified', 'Approved'].includes(m.status)
    );

    if (marksToUnlock.length === 0) {
      return Response.json({
        error: 'No marks found in submittable state'
      }, { status: 404 });
    }

    // Unlock: revert to Draft (server-side)
    const unlockPromises = marksToUnlock.map(m =>
      base44.asServiceRole.entities.Marks.update(m.id, { status: 'Draft' })
    );

    await Promise.all(unlockPromises);

    return Response.json({
      success: true,
      message: `Unlocked ${marksToUnlock.length} marks for editing`,
      records_unlocked: marksToUnlock.length,
      new_status: 'Draft'
    }, { status: 200 });
  } catch (error) {
    console.error('Marks unlock error:', error);
    return Response.json(
      { error: error.message || 'Failed to unlock marks' },
      { status: 500 }
    );
  }
});