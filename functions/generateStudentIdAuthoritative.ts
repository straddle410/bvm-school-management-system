import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { academic_year } = payload;

    if (!academic_year) {
      return Response.json({ error: 'academic_year is required' }, { status: 400 });
    }

    // Validate format: "2025-26"
    const match = academic_year.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return Response.json({ error: 'Invalid academic_year format. Expected YYYY-YY (e.g. 2025-26)' }, { status: 400 });
    }

    const startYear = match[1]; // "2025"
    const yy = startYear.slice(2); // "25"
    const counterKey = `student_id_${startYear}`;

    // Get or create counter for this academic year
    const counters = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
    let counter = counters[0];
    let nextValue;

    if (!counter) {
      // First student of this academic year — find max existing ID for this year prefix
      const allStudents = await base44.asServiceRole.entities.Student.list('', 10000);
      const pattern = new RegExp(`^S${yy}(\\d{3})$`, 'i');
      const existing = allStudents
        .map(s => s.student_id)
        .filter(id => id && pattern.test(id))
        .map(id => {
          const match = id.match(/^S\d{2}(\d{3})$/i);
          return match ? parseInt(match[1], 10) : 0;
        });
      const maxExisting = existing.length > 0 ? Math.max(...existing) : 0;
      nextValue = maxExisting + 1;

      try {
        counter = await base44.asServiceRole.entities.Counter.create({
          key: counterKey,
          current_value: nextValue
        });
      } catch (createErr) {
        // Race condition: another concurrent request created it
        const existing = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
        counter = existing[0];
        nextValue = (counter.current_value || 0) + 1;
      }
    } else {
      nextValue = (counter.current_value || 0) + 1;
    }

    // Always update to ensure proper sequence
    if (counter) {
      try {
        await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: nextValue });
      } catch (e) {
        // Retry once on conflict
        const latest = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
        if (latest[0]) {
          const latestVal = latest[0].current_value || 0;
          nextValue = Math.max(nextValue, latestVal + 1);
          await base44.asServiceRole.entities.Counter.update(latest[0].id, { current_value: nextValue });
        }
      }
    }

    const studentId = `S${yy}${String(nextValue).padStart(3, '0')}`;
    const studentIdNorm = studentId.toLowerCase();

    // Case-insensitive uniqueness check
    let attempts = 0;
    let finalId = studentId;
    let finalNorm = studentIdNorm;
    let finalNextValue = nextValue;

    while (attempts < 10) {
      const dupe = await base44.asServiceRole.entities.Student.filter({
        student_id_norm: finalNorm
      });
      if (dupe.length === 0) break;
      finalNextValue++;
      finalId = `S${yy}${String(finalNextValue).padStart(3, '0')}`;
      finalNorm = finalId.toLowerCase();
      await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: finalNextValue });
      attempts++;
    }

    if (attempts >= 10) {
      return Response.json(
        { error: 'Failed to generate unique student ID after 10 attempts' },
        { status: 500 }
      );
    }

    return Response.json({
      student_id: finalId,
      student_id_norm: finalNorm,
      academic_year,
      counter_value: finalNextValue
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});