import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const testAcademicYear = '2025-26';
    const testClassName = 'Nursery';
    const testSubjects = ['English', 'Mathematics', 'Science'];

    // Step 1: Save mapping
    console.log(`[TEST] Saving mapping for ${testAcademicYear} / ${testClassName}`);
    const saveResult = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testAcademicYear,
      class_name: testClassName
    });

    let savedRecord;
    if (saveResult.length > 0) {
      console.log(`[TEST] Found existing record: ${saveResult[0].id}`);
      savedRecord = await base44.asServiceRole.entities.ClassSubjectConfig.update(saveResult[0].id, {
        subject_names: testSubjects
      });
    } else {
      console.log(`[TEST] Creating new record`);
      savedRecord = await base44.asServiceRole.entities.ClassSubjectConfig.create({
        academic_year: testAcademicYear,
        class_name: testClassName,
        subject_names: testSubjects
      });
    }

    console.log(`[TEST] Saved record ID: ${savedRecord.id}`);
    console.log(`[TEST] Saved subjects: ${JSON.stringify(savedRecord.subject_names)}`);

    // Step 2: Read back immediately
    const readBack = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: testAcademicYear,
      class_name: testClassName
    });

    if (readBack.length === 0) {
      return Response.json({
        status: 'FAIL',
        reason: 'Record not found after save',
        savedRecord,
        readBack: []
      });
    }

    const readRecord = readBack[0];
    console.log(`[TEST] Read back record ID: ${readRecord.id}`);
    console.log(`[TEST] Read back subjects: ${JSON.stringify(readRecord.subject_names)}`);

    // Step 3: Assert exact match
    const saved = JSON.stringify(readRecord.subject_names?.sort());
    const expected = JSON.stringify(testSubjects.sort());
    const match = saved === expected;

    return Response.json({
      status: match ? 'PASS' : 'FAIL',
      reason: match ? 'Subjects match exactly' : `Mismatch: saved=${saved}, expected=${expected}`,
      recordId: readRecord.id,
      savedSubjects: readRecord.subject_names,
      expectedSubjects: testSubjects,
      match
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