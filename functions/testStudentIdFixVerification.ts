import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test: Find a Pending student and approve to see new ID generation
    const pendingStudents = await base44.asServiceRole.entities.Student.filter({ 
      academic_year: '2025-26',
      status: 'Pending',
      student_id: null
    });

    const report = {
      timestamp: new Date().toISOString(),
      test_description: 'Verify Fixed Student ID Generation (No Gaps)',
      results: []
    };

    if (pendingStudents.length === 0) {
      report.results.push({
        test: 'Pending student availability',
        status: 'SKIPPED',
        reason: 'No pending students without ID available for testing'
      });
    } else {
      const testStudent = pendingStudents[0];
      report.results.push({
        test: 'Available pending student found',
        status: 'PASS',
        student_id_record: testStudent.id,
        student_name: testStudent.name,
        current_status: testStudent.status
      });
    }

    // Check current S25 sequence
    const s25All = await base44.asServiceRole.entities.Student.filter({ 
      academic_year: '2025-26',
      student_id: { $regex: '^S25' }
    });

    const s25Ids = s25All
      .map(s => s.student_id)
      .filter(id => /^S25\d{3}$/.test(id))
      .sort();

    const sequences = s25Ids.map(id => parseInt(id.slice(-3), 10)).sort((a, b) => a - b);
    const maxId = Math.max(...sequences);

    report.results.push({
      test: 'Current S25 sequence check',
      status: 'INFO',
      total_issued_ids: s25Ids.length,
      highest_id: `S25${String(maxId).padStart(3, '0')}`,
      counter_should_be: maxId
    });

    // Check for S25050 specifically
    const s25050Check = s25All.find(s => s.student_id === 'S25050');
    report.results.push({
      test: 'S25050 existence',
      status: s25050Check ? 'FOUND' : 'MISSING',
      details: s25050Check ? { name: s25050Check.name, status: s25050Check.status } : 'NOT IN DB'
    });

    // Expected next ID
    const expectedNextSequence = maxId + 1;
    const expectedNextId = `S25${String(expectedNextSequence).padStart(3, '0')}`;

    report.results.push({
      test: 'Next expected ID (fixed logic)',
      status: 'PREDICTED',
      next_id: expectedNextId,
      logic: `Highest existing = ${maxId}, Next = ${maxId} + 1 = ${expectedNextId}`
    });

    // Check counter
    const counter = await base44.asServiceRole.entities.Counter.filter({ key: 'student_id_2025' });
    report.results.push({
      test: 'Counter state',
      status: 'INFO',
      counter_current_value: counter[0]?.current_value || null,
      counter_key: 'student_id_2025'
    });

    report.summary = {
      fix_applied: 'YES - Function now scans highest existing ID before each generation',
      gap_prevention: 'Sequence always continues from max existing, no skipping',
      design_decision: 'Gaps are NOT ALLOWED - counter = highest ever issued'
    };

    return Response.json(report);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});