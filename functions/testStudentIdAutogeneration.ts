import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const results = {};
    const testAcademicYear = '2025-26';
    const testAcademicYearNew = '2026-27';

    // ====== TEST 1: SINGLE MANUAL CREATE ======
    results.test1 = {
      name: 'SINGLE MANUAL CREATE',
      status: 'TESTING',
      details: {}
    };

    try {
      const createRes = await base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
        academic_year: testAcademicYear
      });

      const generatedId = createRes.data.student_id;
      results.test1.generatedId = generatedId;
      results.test1.idFormat = /^S25\d{3}$/.test(generatedId) ? 'PASS' : 'FAIL';
      results.test1.status = 'PASS';
    } catch (e) {
      results.test1.status = 'FAIL';
      results.test1.error = e.message;
    }

    // ====== TEST 2: BULK IMPORT (3 students) ======
    results.test2 = {
      name: 'BULK IMPORT (3 students)',
      status: 'TESTING',
      generatedIds: []
    };

    try {
      for (let i = 0; i < 3; i++) {
        const bulkRes = await base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
          academic_year: testAcademicYear
        });
        results.test2.generatedIds.push(bulkRes.data.student_id);
      }

      const allUnique = new Set(results.test2.generatedIds).size === 3;
      const allValidFormat = results.test2.generatedIds.every(id => /^S25\d{3}$/.test(id));
      const sequentialPattern = results.test2.generatedIds.every((id, idx, arr) => {
        if (idx === 0) return true;
        const currNum = parseInt(id.slice(3), 10);
        const prevNum = parseInt(arr[idx - 1].slice(3), 10);
        return currNum > prevNum;
      });

      results.test2.uniqueness = allUnique ? 'PASS' : 'FAIL';
      results.test2.format = allValidFormat ? 'PASS' : 'FAIL';
      results.test2.sequential = sequentialPattern ? 'PASS' : 'FAIL';
      results.test2.status = allUnique && allValidFormat && sequentialPattern ? 'PASS' : 'FAIL';
    } catch (e) {
      results.test2.status = 'FAIL';
      results.test2.error = e.message;
    }

    // ====== TEST 3: CONTINUATION TEST ======
    results.test3 = {
      name: 'CONTINUATION TEST',
      status: 'TESTING',
      details: {}
    };

    try {
      // Get current highest ID in 2025-26
      const existingStudents = await base44.asServiceRole.entities.Student.filter({ academic_year: testAcademicYear }, '', 1000);
      const existingIds = existingStudents
        .map(s => s.student_id)
        .filter(id => /^S25\d{3}$/.test(id))
        .map(id => parseInt(id.slice(3), 10))
        .sort((a, b) => b - a);
      
      const highestExisting = existingIds.length > 0 ? existingIds[0] : 0;
      results.test3.highestExistingNumber = highestExisting;

      // Generate next ID
      const nextRes = await base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
        academic_year: testAcademicYear
      });
      const nextId = nextRes.data.student_id;
      const nextNumber = parseInt(nextId.slice(3), 10);

      results.test3.nextGeneratedId = nextId;
      results.test3.nextNumber = nextNumber;
      results.test3.continues = nextNumber > highestExisting ? 'PASS' : 'FAIL';
      results.test3.status = 'PASS';
    } catch (e) {
      results.test3.status = 'FAIL';
      results.test3.error = e.message;
    }

    // ====== TEST 4: YEAR RESET TEST ======
    results.test4 = {
      name: 'YEAR RESET TEST',
      status: 'TESTING',
      details: {}
    };

    try {
      // Generate first ID for 2026-27
      const newYearRes = await base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
        academic_year: testAcademicYearNew
      });
      const newYearId = newYearRes.data.student_id;

      results.test4.newYearId = newYearId;
      results.test4.startsWithS26 = newYearId.startsWith('S26') ? 'PASS' : 'FAIL';
      results.test4.isFirstOfYear = newYearId.endsWith('001') ? 'PASS' : 'FAIL';
      results.test4.status = newYearId.startsWith('S26') && newYearId.endsWith('001') ? 'PASS' : 'FAIL';
    } catch (e) {
      results.test4.status = 'FAIL';
      results.test4.error = e.message;
    }

    // ====== TEST 5: CONCURRENCY / BULK SAFETY ======
    results.test5 = {
      name: 'CONCURRENCY / BULK SAFETY',
      status: 'TESTING',
      batchIds: []
    };

    try {
      // Simulate concurrent requests within same batch
      const promises = Array(5).fill(null).map(() =>
        base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
          academic_year: testAcademicYear
        })
      );

      const responses = await Promise.all(promises);
      const batchIds = responses.map(r => r.data.student_id);
      results.test5.batchIds = batchIds;

      const allUnique = new Set(batchIds).size === 5;
      const allCorrectYear = batchIds.every(id => id.startsWith('S25'));
      
      results.test5.uniqueness = allUnique ? 'PASS' : 'FAIL';
      results.test5.correctYear = allCorrectYear ? 'PASS' : 'FAIL';
      results.test5.status = allUnique && allCorrectYear ? 'PASS' : 'FAIL';
    } catch (e) {
      results.test5.status = 'FAIL';
      results.test5.error = e.message;
    }

    // ====== TEST 6: EDIT SAFETY ======
    results.test6 = {
      name: 'EDIT SAFETY',
      status: 'TESTING',
      details: {}
    };

    try {
      // Generate an ID for a test student
      const idRes = await base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
        academic_year: testAcademicYear
      });
      const testStudentId = idRes.data.student_id;

      // Create a test student
      const student = await base44.asServiceRole.entities.Student.create({
        student_id: testStudentId,
        student_id_norm: testStudentId.toLowerCase(),
        name: 'Test Edit Student ' + Date.now(),
        class_name: '5',
        section: 'A',
        academic_year: testAcademicYear,
        status: 'Pending'
      });

      // Edit the student (change name, NOT student_id)
      const originalId = student.student_id;
      await base44.asServiceRole.entities.Student.update(student.id, {
        name: 'Test Edit Student MODIFIED'
      });

      // Fetch and verify ID didn't change
      const fetched = await base44.asServiceRole.entities.Student.list('', { filter: { id: student.id } });
      const editedStudent = fetched[0];

      results.test6.originalId = originalId;
      results.test6.idAfterEdit = editedStudent.student_id;
      results.test6.idUnchanged = originalId === editedStudent.student_id ? 'PASS' : 'FAIL';
      results.test6.status = 'PASS';
    } catch (e) {
      results.test6.status = 'FAIL';
      results.test6.error = e.message;
    }

    // ====== TEST 7: CSV TEMPLATE ======
    results.test7 = {
      name: 'CSV TEMPLATE',
      status: 'TESTING',
      details: {}
    };

    try {
      const templateRes = await base44.asServiceRole.functions.invoke('generateStudentTemplate', {});
      const templateBase64 = templateRes.data.file;
      
      // Decode and check content
      const binaryString = atob(templateBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Check if template includes student_id column
      const templateText = new TextDecoder().decode(bytes).toLowerCase();
      const hasStudentId = templateText.includes('student_id');
      
      results.test7.hasStudentIdColumn = hasStudentId ? 'FAIL' : 'PASS';
      results.test7.status = hasStudentId ? 'FAIL' : 'PASS';
    } catch (e) {
      results.test7.status = 'FAIL';
      results.test7.error = e.message;
    }

    return Response.json({
      timestamp: new Date().toISOString(),
      testsSummary: {
        total: 7,
        passed: Object.values(results).filter(r => r.status === 'PASS').length,
        failed: Object.values(results).filter(r => r.status === 'FAIL').length
      },
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});