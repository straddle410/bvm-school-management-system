import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const testClass = async (base44, academicYear, className, subjects) => {
  console.log(`[TEST_${className}] Starting test for ${academicYear} / ${className}`);
  
  const saveResult = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
    academic_year: academicYear,
    class_name: className
  });

  let savedRecord;
  if (saveResult.length > 0) {
    console.log(`[TEST_${className}] Found existing record: ${saveResult[0].id}`);
    savedRecord = await base44.asServiceRole.entities.ClassSubjectConfig.update(saveResult[0].id, {
      subject_names: subjects
    });
  } else {
    console.log(`[TEST_${className}] Creating new record`);
    savedRecord = await base44.asServiceRole.entities.ClassSubjectConfig.create({
      academic_year: academicYear,
      class_name: className,
      subject_names: subjects
    });
  }

  console.log(`[TEST_${className}] Saved record ID: ${savedRecord.id}`);
  console.log(`[TEST_${className}] Saved subjects: ${JSON.stringify(savedRecord.subject_names)}`);

  // Immediate refetch
  const readBack = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
    academic_year: academicYear,
    class_name: className
  });

  if (readBack.length === 0) {
    return {
      className,
      status: 'FAIL',
      reason: 'Record not found after save'
    };
  }

  const readRecord = readBack[0];
  console.log(`[TEST_${className}] Read back record ID: ${readRecord.id}`);
  console.log(`[TEST_${className}] Read back subjects: ${JSON.stringify(readRecord.subject_names)}`);

  const saved = JSON.stringify(readRecord.subject_names?.sort());
  const expected = JSON.stringify(subjects.sort());
  const match = saved === expected;

  return {
    className,
    status: match ? 'PASS' : 'FAIL',
    reason: match ? 'Subjects match exactly' : `Mismatch: saved=${saved}, expected=${expected}`,
    recordId: readRecord.id,
    savedSubjects: readRecord.subject_names,
    expectedSubjects: subjects,
    match
  };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const testAcademicYear = '2025-26';
    const testCases = [
      { className: 'Nursery', subjects: ['English', 'Mathematics', 'Science'] },
      { className: 'LKG', subjects: ['English', 'Mathematics', 'Science', 'EVS'] },
      { className: '1', subjects: ['English', 'Hindi', 'Mathematics', 'Science', 'Social Studies'] }
    ];

    const results = [];
    for (const testCase of testCases) {
      const result = await testClass(base44, testAcademicYear, testCase.className, testCase.subjects);
      results.push(result);
    }

    const allPass = results.every(r => r.status === 'PASS');

    return Response.json({
      status: allPass ? 'PASS' : 'FAIL',
      totalTests: results.length,
      passedTests: results.filter(r => r.status === 'PASS').length,
      results
    });

  } catch (error) {
    console.error(`[TEST] Error: ${error.message}`);
    return Response.json({
      status: 'FAIL',
      reason: error.message,
      stack: error.stack
    });
  }
});