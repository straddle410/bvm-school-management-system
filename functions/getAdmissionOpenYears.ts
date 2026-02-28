import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all years with admission_open = true
    const admissionYears = await base44.asServiceRole.entities.AcademicYear.filter({
      admission_open: true
    });

    if (admissionYears.length === 0) {
      return Response.json({
        error: 'Admissions are currently closed.'
      }, { status: 422 });
    }

    // Sort by start_date descending (latest year first)
    const sorted = admissionYears.sort((a, b) => new Date(b.start_date) - new Date(a.start_date));

    // Return array of {year} objects
    const result = sorted.map(y => ({ year: y.year }));

    return Response.json({
      success: true,
      years: result
    }, { status: 200 });
  } catch (error) {
    console.error('[getAdmissionOpenYears] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});