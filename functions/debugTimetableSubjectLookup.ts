import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Read-only diagnostic: Simulate EXACT flow TimetableForm uses
 * Reproduce the getSubjectsForClass lookup for Nursery
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bodyJson = await req.json().catch(() => ({}));
    const academicYear = bodyJson.academic_year || '2025-26';
    const className = bodyJson.class_name || 'Nursery';

    console.log(`[TIMETABLE_FLOW] Starting lookup for ${academicYear}/${className}`);

    // ========== STEP 1: Normalize class name (same as subjectHelper.js:19-40) ==========
    const normalizeClassName = (cls) => {
      if (!cls) return '';
      const input = cls.toString().trim().toLowerCase();
      if (input === 'nursery') return 'Nursery';
      if (input === 'lkg') return 'LKG';
      if (input === 'ukg') return 'UKG';
      const stripped = input.replace(/^class\s*/, '').trim();
      const num = parseInt(stripped, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) return String(num);
      return cls.toString().trim();
    };

    const normalizedClass = normalizeClassName(className);
    console.log(`[TIMETABLE_FLOW] Step 1 - Normalization: "${className}" → "${normalizedClass}"`);

    // ========== STEP 2: Query ClassSubjectConfig (same as subjectHelper.js:67-70) ==========
    console.log(`[TIMETABLE_FLOW] Step 2 - Querying: ClassSubjectConfig.filter({ academic_year: "${academicYear}", class_name: "${normalizedClass}" })`);

    const configs = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: academicYear,
      class_name: normalizedClass
    });

    console.log(`[TIMETABLE_FLOW] Step 2 - Query returned ${configs.length} record(s)`);

    if (configs.length === 0) {
      console.log(`[TIMETABLE_FLOW] Step 3 - NO RECORD FOUND`);
      return Response.json({
        status: 'EMPTY',
        reason: 'No ClassSubjectConfig record found',
        normalizedClass,
        academicYear,
        queriedWith: { academic_year: academicYear, class_name: normalizedClass },
        subjects: [],
        source: 'GLOBAL',
        mappingExists: false
      });
    }

    const config = configs[0];
    console.log(`[TIMETABLE_FLOW] Step 3 - Record found, checking subject_names`);

    // ========== STEP 3: Check if subject_names is valid array (same as subjectHelper.js:81) ==========
    const hasValidSubjects = Array.isArray(config.subject_names) && config.subject_names.length > 0;
    console.log(`[TIMETABLE_FLOW] Step 3 - subject_names is array: ${Array.isArray(config.subject_names)}`);
    console.log(`[TIMETABLE_FLOW] Step 3 - subject_names length: ${config.subject_names?.length || 0}`);
    console.log(`[TIMETABLE_FLOW] Step 3 - Has valid subjects: ${hasValidSubjects}`);

    if (!hasValidSubjects) {
      console.log(`[TIMETABLE_FLOW] Step 4 - VALIDATION FAILED (subjects array empty or null)`);
      return Response.json({
        status: 'EMPTY_SUBJECTS',
        reason: 'ClassSubjectConfig found but subject_names is empty or invalid',
        record: {
          id: config.id,
          academic_year: config.academic_year,
          class_name: config.class_name,
          subject_names: config.subject_names,
          subject_names_type: typeof config.subject_names,
          subject_names_is_array: Array.isArray(config.subject_names),
          subject_names_length: config.subject_names?.length
        },
        subjects: [],
        source: 'GLOBAL',
        mappingExists: false
      });
    }

    // ========== STEP 4: Return subjects (same as subjectHelper.js:86-91) ==========
    console.log(`[TIMETABLE_FLOW] Step 4 - SUCCESS. Returning ${config.subject_names.length} subjects`);

    return Response.json({
      status: 'SUCCESS',
      normalizedClass,
      academicYear,
      record: {
        id: config.id,
        academic_year: config.academic_year,
        class_name: config.class_name,
        subject_names: config.subject_names,
        created_date: config.created_date,
        updated_date: config.updated_date
      },
      subjects: config.subject_names,
      source: 'MAPPING',
      mappingExists: true,
      flowTrace: {
        step1_normalization: `"${className}" → "${normalizedClass}"`,
        step2_query: `ClassSubjectConfig.filter({ academic_year: "${academicYear}", class_name: "${normalizedClass}" })`,
        step3_validation: `subject_names is array with ${config.subject_names.length} items`,
        step4_result: `Returning ${config.subject_names.length} subjects to TimetableForm dropdown`
      }
    });

  } catch (error) {
    console.error('[TIMETABLE_FLOW] Error:', error);
    return Response.json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});