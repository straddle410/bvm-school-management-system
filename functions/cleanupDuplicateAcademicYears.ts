import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Cleanup duplicate AcademicYear records (among NON-archived only).
// Groups active records by year value, keeps ONE per year (priority: Active > admission_open=true > latest start_date).
// Marks all others: status=Archived, is_current=false, admission_open=false.
// Returns: activeYears count, archivedYears count, duplicatesRemainingActive (should be 0).

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allYears = await base44.asServiceRole.entities.AcademicYear.list('-start_date');

    // Separate active from already-archived
    const alreadyArchived = allYears.filter(y => (y.status || '').toLowerCase() === 'archived');
    const activeRecords = allYears.filter(y => (y.status || 'Active').toLowerCase() !== 'archived');

    // Group active records by year string
    const byYear = {};
    for (const y of activeRecords) {
      if (!byYear[y.year]) byYear[y.year] = [];
      byYear[y.year].push(y);
    }

    let archivedCount = 0;
    const details = [];

    for (const [yearStr, records] of Object.entries(byYear)) {
      if (records.length <= 1) continue;

      // Pick the best record to keep
      const sorted = records.sort((a, b) => {
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (b.status === 'Active' && a.status !== 'Active') return 1;
        if (a.admission_open && !b.admission_open) return -1;
        if (b.admission_open && !a.admission_open) return 1;
        return 0; // already sorted by -start_date
      });

      const keeper = sorted[0];
      const dupes = sorted.slice(1);

      for (const dupe of dupes) {
        await base44.asServiceRole.entities.AcademicYear.update(dupe.id, {
          status: 'Archived',
          is_current: false,
          admission_open: false
        });
        archivedCount++;
        details.push(`Archived duplicate "${dupe.year}" (id: ${dupe.id}), kept id: ${keeper.id}`);
        console.log(`[cleanupDuplicateAcademicYears] ${details[details.length - 1]}`);
      }
    }

    // Compute final counts
    const totalArchived = alreadyArchived.length + archivedCount;
    const totalActive = activeRecords.length - archivedCount;

    // Check for remaining active duplicates (should be 0 after cleanup)
    const finalByYear = {};
    for (const y of activeRecords) {
      const wasArchived = details.some(d => d.includes(`id: ${y.id})`));
      if (!wasArchived) {
        if (!finalByYear[y.year]) finalByYear[y.year] = 0;
        finalByYear[y.year]++;
      }
    }
    const duplicatesRemainingActive = Object.values(finalByYear).filter(c => c > 1).length;

    return Response.json({
      success: true,
      message: archivedCount === 0
        ? 'No duplicates found — all clean!'
        : `Archived ${archivedCount} duplicate(s). One record kept per year.`,
      archivedCount,
      activeYears: totalActive,
      archivedYears: totalArchived,
      duplicatesRemainingActive,
      details
    });
  } catch (error) {
    console.error('[cleanupDuplicateAcademicYears] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});