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
    let counter = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
    counter = counter[0];
    
    let nextValue;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      try {
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

          counter = await base44.asServiceRole.entities.Counter.create({
            key: counterKey,
            current_value: nextValue
          });
          break; // Success
        } else {
          // Increment existing counter
          nextValue = (counter.current_value || 0) + 1;
          await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: nextValue });
          break; // Success
        }
      } catch (e) {
        // Conflict: refresh counter and retry
        attempts++;
        const refreshed = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
        counter = refreshed[0];
        
        if (!counter && attempts < maxAttempts) {
          // Still no counter, try again
          await new Promise(r => setTimeout(r, 10 * attempts));
          counter = null;
          continue;
        }
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to acquire counter lock after ${maxAttempts} attempts`);
        }
      }
    }

    const studentId = `S${yy}${String(nextValue).padStart(3, '0')}`;
    const studentIdNorm = studentId.toLowerCase();

    // Case-insensitive uniqueness check
    let uniqueAttempts = 0;
    let finalId = studentId;
    let finalNorm = studentIdNorm;
    let finalNextValue = nextValue;

    while (uniqueAttempts < 10) {
      const dupe = await base44.asServiceRole.entities.Student.filter({
        student_id_norm: finalNorm
      });
      if (dupe.length === 0) break;
      finalNextValue++;
      finalId = `S${yy}${String(finalNextValue).padStart(3, '0')}`;
      finalNorm = finalId.toLowerCase();
      await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: finalNextValue });
      uniqueAttempts++;
    }

    if (uniqueAttempts >= 10) {
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