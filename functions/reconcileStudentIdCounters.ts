import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const students = await base44.asServiceRole.entities.Student.list('', 10000);
    const counters = await base44.asServiceRole.entities.Counter.list('', 1000);

    // Group students by academic year
    const yearGroups = {};
    students.forEach(s => {
      if (s.academic_year && s.student_id) {
        if (!yearGroups[s.academic_year]) yearGroups[s.academic_year] = [];
        yearGroups[s.academic_year].push(s.student_id);
      }
    });

    const updates = [];
    const report = [];

    for (const [year, ids] of Object.entries(yearGroups)) {
      // Extract start year from "2025-26" => "2025"
      const match = year.match(/^(\d{4})-(\d{2})$/);
      if (!match) continue;
      const startYear = match[1];
      const yy = startYear.slice(2);
      const counterKey = `student_id_${startYear}`;

      // Find max sequence for this year
      const pattern = new RegExp(`^S${yy}(\\d{3})$`, 'i');
      const sequences = ids
        .map(id => {
          const m = id.match(/^S\d{2}(\d{3})$/i);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter(s => s > 0);

      const maxSeq = sequences.length > 0 ? Math.max(...sequences) : 0;

      // Find counter and update if needed
      const counter = counters.find(c => c.key === counterKey);
      if (counter) {
        const currentValue = counter.current_value || 0;
        if (currentValue !== maxSeq) {
          updates.push({ counter_id: counter.id, key: counterKey, old_value: currentValue, new_value: maxSeq });
        }
      } else {
        updates.push({ counter_id: null, key: counterKey, old_value: null, new_value: maxSeq, action: 'CREATE' });
      }

      report.push({
        academic_year: year,
        year_prefix: yy,
        counter_key: counterKey,
        max_sequence_found: maxSeq,
        student_count: ids.length,
        action: counter && counter.current_value === maxSeq ? 'NO_CHANGE' : 'UPDATE'
      });
    }

    // Apply updates
    for (const upd of updates) {
      if (upd.action === 'CREATE') {
        await base44.asServiceRole.entities.Counter.create({
          key: upd.key,
          current_value: upd.new_value
        });
      } else if (upd.counter_id) {
        await base44.asServiceRole.entities.Counter.update(upd.counter_id, { current_value: upd.new_value });
      }
    }

    return Response.json({
      status: 'completed',
      counters_checked: report.length,
      counters_updated: updates.filter(u => u.action !== 'NO_CHANGE').length,
      report,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});