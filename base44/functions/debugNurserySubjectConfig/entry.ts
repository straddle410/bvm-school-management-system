import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Read-only diagnostic: Query ClassSubjectConfig for Nursery
 * Verify if subjects in database match what UI shows
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get current academic year from context
    const bodyJson = await req.json().catch(() => ({}));
    const academicYear = bodyJson.academic_year || '2025-26';

    console.log(`[DEBUG_NURSERY] Querying for academic year: ${academicYear}`);

    // Query 1: Get Nursery config for current year
    const nurseryConfigs = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: academicYear,
      class_name: 'Nursery'
    });

    console.log(`[DEBUG_NURSERY] Query result: ${nurseryConfigs.length} record(s) found`);

    if (nurseryConfigs.length === 0) {
      return Response.json({
        status: 'NO_DATA',
        message: `No ClassSubjectConfig found for ${academicYear}/Nursery`,
        query: {
          academic_year: academicYear,
          class_name: 'Nursery'
        },
        result: null
      });
    }

    const record = nurseryConfigs[0];

    // Query 2: Get all ClassSubjectConfig records for this year to see what's there
    const allForYear = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: academicYear
    });

    console.log(`[DEBUG_NURSERY] Total ClassSubjectConfig records for ${academicYear}: ${allForYear.length}`);

    // Query 3: List all class names in this year
    const classNames = new Set();
    allForYear.forEach(cfg => {
      if (cfg.class_name) classNames.add(cfg.class_name);
    });

    return Response.json({
      status: 'FOUND',
      academicYear: academicYear,
      nurseryRecord: {
        id: record.id,
        academic_year: record.academic_year,
        class_name: record.class_name,
        subject_names: record.subject_names,
        subject_count: record.subject_names?.length || 0,
        created_date: record.created_date,
        updated_date: record.updated_date
      },
      yearStatistics: {
        totalConfigsInYear: allForYear.length,
        allClassesConfigured: Array.from(classNames).sort(),
        configurationStatus: {
          nurseryHasSubjects: record.subject_names && record.subject_names.length > 0,
          subjectsAreArray: Array.isArray(record.subject_names),
          subjectsAreEmpty: record.subject_names && record.subject_names.length === 0,
          subjectsAreNull: record.subject_names === null || record.subject_names === undefined
        }
      },
      debugLog: {
        message: `Database shows: class_name="${record.class_name}", subject_names=[${record.subject_names?.join(', ') || 'EMPTY'}]`
      }
    });

  } catch (error) {
    console.error('[DEBUG_NURSERY] Error:', error);
    return Response.json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});