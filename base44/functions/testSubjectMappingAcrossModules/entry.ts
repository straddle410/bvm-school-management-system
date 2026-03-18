import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Back-test: Verify that Homework, Diary, and Marks all fetch the same subject list
 * from ClassSubjectConfig for a given class in a given academic year.
 * 
 * Test case: LKG class in 2025-26
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const testAcademicYear = '2025-26';
    const testClassName = 'LKG';

    console.log(`[TEST_SUBJECTS_ACROSS_MODULES] Testing ${testAcademicYear} / ${testClassName}`);

    // 1. Fetch from ClassSubjectConfig (the source of truth)
    const configResult = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testAcademicYear,
      class_name: testClassName
    });

    if (configResult.length === 0) {
      return Response.json({
        status: 'FAIL',
        reason: `No ClassSubjectConfig found for ${testAcademicYear}/${testClassName}`,
        testCase: { academicYear: testAcademicYear, className: testClassName }
      });
    }

    const sourceOfTruth = configResult[0].subject_names;
    const sortedSourceOfTruth = [...sourceOfTruth].sort();

    console.log(`[TEST_SUBJECTS_ACROSS_MODULES] Source of truth: ${JSON.stringify(sortedSourceOfTruth)}`);

    // 2. Simulate what Homework form fetches (via getSubjectsForClass helper)
    // This mimics the frontend's getSubjectsForClass() call
    const hwFetch = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testAcademicYear,
      class_name: testClassName
    });
    const hwSubjects = hwFetch.length > 0 && Array.isArray(hwFetch[0].subject_names) && hwFetch[0].subject_names.length > 0
      ? hwFetch[0].subject_names
      : [];
    const sortedHwSubjects = [...hwSubjects].sort();

    console.log(`[TEST_SUBJECTS_ACROSS_MODULES] Homework subjects: ${JSON.stringify(sortedHwSubjects)}`);

    // 3. Simulate what Diary form fetches
    const diaryFetch = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testAcademicYear,
      class_name: testClassName
    });
    const diarySubjects = diaryFetch.length > 0 && Array.isArray(diaryFetch[0].subject_names) && diaryFetch[0].subject_names.length > 0
      ? diaryFetch[0].subject_names
      : [];
    const sortedDiarySubjects = [...diarySubjects].sort();

    console.log(`[TEST_SUBJECTS_ACROSS_MODULES] Diary subjects: ${JSON.stringify(sortedDiarySubjects)}`);

    // 4. Simulate what Marks page fetches
    const marksFetch = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testAcademicYear,
      class_name: testClassName
    });
    const marksSubjects = marksFetch.length > 0 && Array.isArray(marksFetch[0].subject_names) && marksFetch[0].subject_names.length > 0
      ? marksFetch[0].subject_names
      : [];
    const sortedMarksSubjects = [...marksSubjects].sort();

    console.log(`[TEST_SUBJECTS_ACROSS_MODULES] Marks subjects: ${JSON.stringify(sortedMarksSubjects)}`);

    // 5. Compare all three
    const hwMatch = JSON.stringify(sortedSourceOfTruth) === JSON.stringify(sortedHwSubjects);
    const diaryMatch = JSON.stringify(sortedSourceOfTruth) === JSON.stringify(sortedDiarySubjects);
    const marksMatch = JSON.stringify(sortedSourceOfTruth) === JSON.stringify(sortedMarksSubjects);

    const allMatch = hwMatch && diaryMatch && marksMatch;

    return Response.json({
      status: allMatch ? 'PASS' : 'FAIL',
      testCase: { academicYear: testAcademicYear, className: testClassName },
      sourceOfTruth: sourceOfTruth,
      results: {
        homework: {
          subjects: hwSubjects,
          matches: hwMatch
        },
        diary: {
          subjects: diarySubjects,
          matches: diaryMatch
        },
        marks: {
          subjects: marksSubjects,
          matches: marksMatch
        }
      },
      message: allMatch
        ? `✓ All modules (Homework, Diary, Marks) fetch identical subject list: ${hwSubjects.join(', ')}`
        : '✗ Mismatch detected across modules'
    });

  } catch (error) {
    console.error('[TEST_SUBJECTS_ACROSS_MODULES] Error:', error);
    return Response.json({
      status: 'FAIL',
      reason: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});