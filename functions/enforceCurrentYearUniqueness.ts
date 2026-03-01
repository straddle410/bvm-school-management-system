import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Ensures exactly ONE AcademicYear has is_current = true.
// Priority: Active status > most recent start_date.
// Called by the UI to fix existing duplicate is_current records.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const allYears = await base44.asServiceRole.entities.AcademicYear.list('-start_date');

    const currentYears = allYears.filter(y => y.is_current);

    if (currentYears.length <= 1) {
      return Response.json({ success: true, message: 'No duplicates found', fixed: 0 });
    }

    // Pick the best candidate: prefer Active status, then most recent start_date (list is already sorted)
    const best = currentYears.find(y => y.status === 'Active') || currentYears[0];

    let fixed = 0;
    for (const year of currentYears) {
      if (year.id !== best.id) {
        await base44.asServiceRole.entities.AcademicYear.update(year.id, { is_current: false });
        fixed++;
      }
    }

    return Response.json({
      success: true,
      message: `Fixed ${fixed} duplicate(s). Current year is now: ${best.year}`,
      currentYear: best.year,
      fixed
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});