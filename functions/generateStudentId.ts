import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { academic_year } = await req.json();
    if (!academic_year) return Response.json({ error: 'academic_year is required' }, { status: 400 });

    // Extract start year: "2025-26" → "2025" → "25"
    const match = academic_year.match(/^(\d{4})-(\d{2})$/);
    if (!match) return Response.json({ error: 'Invalid academic_year format. Expected YYYY-YY (e.g. 2025-26)' }, { status: 400 });

    const startYear = match[1]; // "2025"
    const yy = startYear.slice(2); // "25"
    const counterKey = `student_id_${startYear}`;

    // Get or create counter for this academic year
    const counters = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
    let counter = counters[0];
    let nextValue;

    if (!counter) {
      // First student of this academic year — find max existing ID for this year prefix to avoid collision
      const allStudents = await base44.asServiceRole.entities.Student.list('-created_date', 1000);
      const pattern = new RegExp(`^S${yy}(\\d{3})$`);
      const existing = allStudents
        .map(s => s.student_id)
        .filter(id => id && pattern.test(id))
        .map(id => parseInt(id.replace(`S${yy}`, ''), 10));
      const maxExisting = existing.length > 0 ? Math.max(...existing) : 0;
      nextValue = maxExisting + 1;

      counter = await base44.asServiceRole.entities.Counter.create({
        key: counterKey,
        current_value: nextValue
      });
    } else {
      nextValue = (counter.current_value || 0) + 1;
      await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: nextValue });
    }

    let studentId = `S${yy}${String(nextValue).padStart(3, '0')}`;

    // Uniqueness check — if collision, keep incrementing
    let attempts = 0;
    while (attempts < 10) {
      const dupe = await base44.asServiceRole.entities.Student.filter({ student_id: studentId });
      if (dupe.length === 0) break;
      nextValue++;
      await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: nextValue });
      studentId = `S${yy}${String(nextValue).padStart(3, '0')}`;
      attempts++;
    }

    return Response.json({ student_id: studentId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});