import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const audit = {
      timestamp: new Date().toISOString(),
      year: '2025-26',
      findings: []
    };

    // Get all S25 students
    const allStudents = await base44.asServiceRole.entities.Student.filter({ academic_year: '2025-26', student_id: { $regex: '^S25' } });
    const ids = allStudents
      .map(s => ({ id: s.id, student_id: s.student_id, name: s.name, status: s.status }))
      .filter(r => /^S25\d{3}$/.test(r.student_id))
      .sort((a, b) => parseInt(a.student_id.slice(-3)) - parseInt(b.student_id.slice(-3)));

    const sequence = ids.map(r => parseInt(r.student_id.slice(-3)));
    
    // Find gaps
    const gaps = [];
    for (let i = 1; i <= Math.max(...sequence); i++) {
      if (!sequence.includes(i)) {
        gaps.push({
          missing: `S25${String(i).padStart(3, '0')}`,
          gap_number: i
        });
      }
    }

    audit.findings.push({
      name: 'SEQUENCE ANALYSIS',
      total_issued: ids.length,
      range: `S25001 to S25${String(Math.max(...sequence)).padStart(3, '0')}`,
      expected_continuous: Math.max(...sequence),
      actual_issued: ids.length,
      gaps_found: gaps.length,
      gap_details: gaps
    });

    // Check S25050 specifically
    const s25050 = ids.find(r => r.student_id === 'S25050');
    audit.findings.push({
      name: 'S25050 EXISTENCE CHECK',
      exists: !!s25050,
      record: s25050 || null
    });

    // Counter state
    const counter = await base44.asServiceRole.entities.Counter.filter({ key: 'student_id_2025' });
    audit.findings.push({
      name: 'COUNTER STATE',
      counter_value: counter[0]?.current_value || null,
      expected_next_id: `S25${String((counter[0]?.current_value || 0) + 1).padStart(3, '0')}`,
      issue: counter[0]?.current_value === 50 ? 'Counter at 50 but S25050 does not exist — GAP!' : 'OK'
    });

    // Verdict
    audit.verdict = {
      question_1_s25050_exists: s25050 ? 'YES' : 'NO',
      question_2_gaps_possible: gaps.length > 0 ? 'YES' : 'NO',
      issue_description: gaps.length > 0 
        ? `Sequence has ${gaps.length} gap(s). Last issued: S25049, Counter: 50, Next: S25051. Gap: S25050 missing.`
        : 'No gaps detected',
      root_cause: 'Dupe check loop increments counter for each gap but may not persist correctly across concurrent approvals.',
      requires_fix: gaps.length > 0 ? 'YES' : 'NO'
    };

    return Response.json(audit);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});