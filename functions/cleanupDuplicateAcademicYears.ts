import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Cleanup duplicate AcademicYear records.
// Groups by year value, keeps ONE per year (priority: Active > admission_open=true > latest start_date).
// Marks all others: status=Archived, is_current=false, admission_open=false.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allYears = await base44.asServiceRole.entities.AcademicYear.list('-start_date');

    // Group by year string
    const byYear = {};
    for (const y of allYears) {
      if (!byYear[y.year]) byYear[y.year] = [];
      byYear[y.year].push(y);
    }

    let archivedCount = 0;
    const details = [];

    for (const [yearStr, records] of Object.entries(byYear)) {
      if (records.length <= 1) continue; // No duplicate

      // Pick the best record to keep
      const sorted = records.sort((a, b) => {
        // Priority 1: Active status
        if (a.status === 'Active' && b.status !== 'Active') return -1;
        if (b.status === 'Active' && a.status !== 'Active') return 1;
        // Priority 2: admission_open = true
        if (a.admission_open && !b.admission_open) return -1;
        if (b.admission_open && !a.admission_open) return 1;
        // Priority 3: latest start_date (already sorted by -start_date from list)
        return 0;
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

    return Response.json({
      success: true,
      message: archivedCount === 0
        ? 'No duplicates found — all clean!'
        : `Archived ${archivedCount} duplicate(s). One record kept per year.`,
      archivedCount,
      details
    });
  } catch (error) {
    console.error('[cleanupDuplicateAcademicYears] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});