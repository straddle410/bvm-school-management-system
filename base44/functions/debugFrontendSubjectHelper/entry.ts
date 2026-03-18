import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Read-only diagnostic: Test what FRONTEND getSubjectsForClass helper would return
 * This simulates the EXACT code in components/subjectHelper.js
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

    console.log(`[FRONTEND_HELPER] Simulating getSubjectsForClass("${academicYear}", "${className}")`);

    // ===== EXACT CODE FROM subjectHelper.js:19-40 =====
    const normalizeClassName = (cls) => {
      if (!cls) return '';
      const input = cls.toString().trim().toLowerCase();
      if (input === 'nursery') return 'Nursery';
      if (input === 'lkg') return 'LKG';
      if (input === 'ukg') return 'UKG';
      let stripped = input.replace(/^class\s*/, '').trim();
      const num = parseInt(stripped, 10);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        return String(num);
      }
      return cls.toString().trim();
    };

    // ===== EXACT CODE FROM subjectHelper.js:50-102 =====
    if (!academicYear || !className) {
      return Response.json({
        result: { subjects: [], source: 'GLOBAL', mappingExists: false },
        reason: 'Empty parameters'
      });
    }

    const normalizedClass = normalizeClassName(className);
    
    console.log(`[FRONTEND_HELPER] Log 1 - [SUBJECTS_LOOKUP] academicYear=${academicYear}, classRaw=${className}, classCanon=${normalizedClass}`);

    const configs = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: academicYear,
      class_name: normalizedClass
    });
    
    const config = configs.length > 0 ? configs[0] : null;
    console.log(`[FRONTEND_HELPER] Log 2 - [SUBJECTS_LOOKUP_RESULT] found=${!!config}, configYear=${config?.academic_year}, configClass=${config?.class_name}, subjectsCount=${config?.subject_names?.length}`);

    if (configs.length > 0 && Array.isArray(configs[0].subject_names) && configs[0].subject_names.length > 0) {
      console.log(`[FRONTEND_HELPER] SUCCESS - Loaded ${configs[0].subject_names.length} subjects (in stored order) from mapping for ${academicYear}/${normalizedClass}`);
      
      return Response.json({
        status: 'SUCCESS',
        result: {
          subjects: configs[0].subject_names,
          source: 'MAPPING',
          mappingExists: true,
          academicYear: academicYear,
          className: normalizedClass
        },
        debugInfo: {
          configFound: true,
          subjectNamesIsArray: Array.isArray(configs[0].subject_names),
          subjectNamesLength: configs[0].subject_names.length,
          configRecord: {
            id: configs[0].id,
            class_name: configs[0].class_name,
            subject_names: configs[0].subject_names
          }
        }
      });
    }

    console.log(`[FRONTEND_HELPER] NO MAPPING - No mapping found for ${academicYear}/${normalizedClass}. Admin must configure ClassSubjectConfig.`);
    
    return Response.json({
      status: 'NO_MAPPING',
      result: {
        subjects: [],
        source: 'GLOBAL',
        mappingExists: false,
        academicYear: academicYear,
        className: normalizedClass
      },
      debugInfo: {
        configFound: configs.length > 0,
        reason: configs.length === 0 
          ? 'No config record found'
          : configs[0].subject_names === null 
          ? 'subject_names is null'
          : !Array.isArray(configs[0].subject_names)
          ? 'subject_names is not an array'
          : configs[0].subject_names.length === 0
          ? 'subject_names is empty array'
          : 'Unknown reason'
      }
    });

  } catch (error) {
    console.error('[FRONTEND_HELPER] Error:', error);
    return Response.json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});