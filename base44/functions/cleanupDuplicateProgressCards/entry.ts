import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // EXPLICIT ROLE GUARD (admin/principal only)
    const role = String(user?.role || '').trim().toLowerCase();
    if (!['admin', 'principal'].includes(role)) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { academicYear } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'Academic year is required' }, { status: 400 });
    }

    // Fetch all progress cards for this academic year
    const allCards = await base44.asServiceRole.entities.ProgressCard.filter({
      academic_year: academicYear
    });

    // Group by student_id + exam_type to identify duplicates
    const cardsByKey = {};
    allCards.forEach(card => {
      const examType = card.exam_performance?.[0]?.exam_type || 'unknown';
      const key = `${card.student_id}__${examType}`;
      
      if (!cardsByKey[key]) {
        cardsByKey[key] = [];
      }
      cardsByKey[key].push(card);
    });

    // Identify and delete duplicates (keep only the first one for each key)
    let deletedCount = 0;
    for (const key in cardsByKey) {
      const cards = cardsByKey[key];
      if (cards.length > 1) {
        // Delete all except the first (most recent by created_date)
        const sorted = cards.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
        for (let i = 1; i < sorted.length; i++) {
          try {
            await base44.asServiceRole.entities.ProgressCard.delete(sorted[i].id);
            deletedCount++;
          } catch (error) {
            console.warn(`Failed to delete duplicate card ${sorted[i].id}: ${error.message}`);
          }
        }
      }
    }

    return Response.json({
      message: `Cleaned up duplicate progress cards`,
      totalCards: allCards.length,
      uniqueKeys: Object.keys(cardsByKey).length,
      deletedDuplicates: deletedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json(
      { error: error.message || 'Failed to cleanup duplicate progress cards' },
      { status: 500 }
    );
  }
});