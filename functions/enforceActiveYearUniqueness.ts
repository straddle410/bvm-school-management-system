import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { year_id, new_status } = payload;

    // Only process if status is being set to 'Active'
    if (new_status !== 'Active') {
      return Response.json({ success: true }, { status: 200 });
    }

    // Fetch all years with status = 'Active'
    const activeYears = await base44.asServiceRole.entities.AcademicYear.filter({
      status: 'Active'
    });

    // If another year is already Active, set it to 'Closed'
    for (const year of activeYears) {
      if (year.id !== year_id) {
        console.log(`[enforceActiveYearUniqueness] Deactivating previous year: ${year.year}`);
        await base44.asServiceRole.entities.AcademicYear.update(year.id, {
          status: 'Closed'
        });
      }
    }

    return Response.json({ 
      success: true, 
      message: 'Active year uniqueness enforced' 
    }, { status: 200 });
  } catch (error) {
    console.error('[enforceActiveYearUniqueness] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});