import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized - Admin access required' }, { status: 403 });
    }

    const { academicYear } = await req.json();

    // Fetch cards to delete
    const query = academicYear ? { academic_year: academicYear } : {};
    const allCards = await base44.asServiceRole.entities.ProgressCard.filter(query);

    // Delete all matching cards
    let deleted = 0;
    for (const card of allCards) {
      await base44.asServiceRole.entities.ProgressCard.delete(card.id);
      deleted++;
    }

    return Response.json({
      message: `Deleted ${deleted} progress cards${academicYear ? ` for ${academicYear}` : ''}`,
      deletedCount: deleted
    });
  } catch (error) {
    console.error('Delete progress cards error:', error);
    return Response.json(
      { error: error.message || 'Failed to delete progress cards' },
      { status: 500 }
    );
  }
});