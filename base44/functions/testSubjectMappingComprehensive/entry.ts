import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Comprehensive back-test for Class 7, year 2025-26:
 * Verify all modules use the same canonical class_name and fetch identical subjects
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const testYear = '2025-26';
    const testClassRaw = 'Class 7'; // Simulate what user selects in UI

    console.log(`[COMPREHENSIVE_TEST] Starting for: ${testYear} / "${testClassRaw}"`);

    // Normalize class name (must match getSubjectsForClass logic)
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

    const canonicalClass = normalizeClassName(testClassRaw);
    console.log(`[COMPREHENSIVE_TEST] Normalized "${testClassRaw}" -> "${canonicalClass}"`);

    // Query the database for the canonical class_name
    const dbRecord = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testYear,
      class_name: canonicalClass
    });

    if (dbRecord.length === 0) {
      return Response.json({
        status: 'FAIL',
        reason: `No ClassSubjectConfig found in DB for ${testYear}/${canonicalClass}`,
        canonicalClass,
        testYear
      });
    }

    const sourceOfTruth = dbRecord[0].subject_names;
    console.log(`[COMPREHENSIVE_TEST] DB record found. Subjects:`, sourceOfTruth);

    // Simulate what each module fetches
    // 1. Homework Form
    const hwResult = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testYear,
      class_name: canonicalClass
    });
    const hwSubjects = hwResult.length > 0 && Array.isArray(hwResult[0].subject_names) && hwResult[0].subject_names.length > 0
      ? hwResult[0].subject_names
      : [];

    // 2. Diary Form
    const diaryResult = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testYear,
      class_name: canonicalClass
    });
    const diarySubjects = diaryResult.length > 0 && Array.isArray(diaryResult[0].subject_names) && diaryResult[0].subject_names.length > 0
      ? diaryResult[0].subject_names
      : [];

    // 3. Marks Page
    const marksResult = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testYear,
      class_name: canonicalClass
    });
    const marksSubjects = marksResult.length > 0 && Array.isArray(marksResult[0].subject_names) && marksResult[0].subject_names.length > 0
      ? marksResult[0].subject_names
      : [];

    // 4. Timetable Form
    const ttResult = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testYear,
      class_name: canonicalClass
    });
    const ttSubjects = ttResult.length > 0 && Array.isArray(ttResult[0].subject_names) && ttResult[0].subject_names.length > 0
      ? ttResult[0].subject_names
      : [];

    // Compare all
    const hwMatch = JSON.stringify([...sourceOfTruth].sort()) === JSON.stringify([...hwSubjects].sort());
    const diaryMatch = JSON.stringify([...sourceOfTruth].sort()) === JSON.stringify([...diarySubjects].sort());
    const marksMatch = JSON.stringify([...sourceOfTruth].sort()) === JSON.stringify([...marksSubjects].sort());
    const ttMatch = JSON.stringify([...sourceOfTruth].sort()) === JSON.stringify([...ttSubjects].sort());

    const allMatch = hwMatch && diaryMatch && marksMatch && ttMatch;

    return Response.json({
      status: allMatch ? 'PASS' : 'FAIL',
      userInput: { raw: testClassRaw, canonical: canonicalClass },
      testYear,
      sourceOfTruth,
      results: {
        homework: { subjects: hwSubjects, matches: hwMatch },
        diary: { subjects: diarySubjects, matches: diaryMatch },
        marks: { subjects: marksSubjects, matches: marksMatch },
        timetable: { subjects: ttSubjects, matches: ttMatch }
      },
      message: allMatch
        ? `✓ PASS: All modules fetched identical subjects using canonical class_name="${canonicalClass}"`
        : '✗ FAIL: Mismatch detected'
    });

  } catch (error) {
    console.error('[COMPREHENSIVE_TEST] Error:', error);
    return Response.json({
      status: 'FAIL',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});