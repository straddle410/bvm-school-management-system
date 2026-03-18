import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Debug: Query ClassSubjectConfig for Class 7 / 2025-26 with ALL variants
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const year = '2025-26';
    const variants = ['7', 'Class 7', 'Class7', 'VII'];

    console.log(`[DEBUG_CLASS_SUBJECT] Querying for year=${year}, variants=${variants.join(', ')}`);

    const allRecords = [];

    for (const variant of variants) {
      const records = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
        academic_year: year,
        class_name: variant
      });
      console.log(`[DEBUG_CLASS_SUBJECT] variant="${variant}" -> found ${records.length} record(s)`);
      if (records.length > 0) {
        records.forEach(r => {
          allRecords.push({
            id: r.id,
            class_name: r.class_name,
            subject_names: r.subject_names,
            academic_year: r.academic_year
          });
        });
      }
    }

    // Also list ALL Class 7 records for this year (in case stored under different name)
    const allClassSeven = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: year
    });
    const class7Only = allClassSeven.filter(r => 
      r.class_name.includes('7') || r.class_name === 'VII'
    );

    console.log(`[DEBUG_CLASS_SUBJECT] Raw DB records matching "7" or "VII":`, class7Only);

    return Response.json({
      year,
      variants,
      found: allRecords,
      allRecordsForYear: allClassSeven.length,
      class7Only: class7Only.map(r => ({
        id: r.id,
        class_name: r.class_name,
        subject_names: r.subject_names,
        academic_year: r.academic_year
      }))
    });

  } catch (error) {
    console.error('[DEBUG_CLASS_SUBJECT] Error:', error);
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});