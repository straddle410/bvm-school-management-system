/**
 * APPROVAL-TIME ONLY student ID generator.
 * 
 * MUST only be called when transitioning a student to Approved status.
 * NEVER call this at student create/add time.
 * 
 * Algorithm:
 * 1. Fetch current counter for academic year
 * 2. Increment by 1 and write back
 * 3. Verify no existing student_id_norm collision (post-increment dupe check)
 * 4. Return the generated ID — caller is responsible for writing it to the student record
 * 
 * Race safety: Counter is incremented first, then a collision check is done.
 * If a collision is found (extremely unlikely after counter increment), the counter
 * is bumped again and the check is repeated up to 5 times.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { academic_year } = payload;

    if (!academic_year) {
      return Response.json({ error: 'academic_year is required' }, { status: 400 });
    }

    const match = academic_year.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return Response.json({ error: 'Invalid academic_year format. Expected YYYY-YY (e.g. 2025-26)' }, { status: 400 });
    }

    const startYear = match[1]; // "2025"
    const yy = startYear.slice(2); // "25"
    const counterKey = `student_id_${startYear}`;

    // Step 1: Get counter, or bootstrap from existing approved student IDs
    let counter = (await base44.asServiceRole.entities.Counter.filter({ key: counterKey }))[0];

    if (!counter) {
      // Bootstrap: scan all students with IDs for this year prefix to find max
      const allStudents = await base44.asServiceRole.entities.Student.filter({
        academic_year
      });
      const pattern = new RegExp(`^S${yy}(\\d{3})$`, 'i');
      const existingNums = allStudents
        .map(s => s.student_id)
        .filter(id => id && pattern.test(id))
        .map(id => parseInt(id.slice(3), 10));
      const maxExisting = existingNums.length > 0 ? Math.max(...existingNums) : 0;

      // Create counter at the current max — next increment will yield max+1
      counter = await base44.asServiceRole.entities.Counter.create({
        key: counterKey,
        current_value: maxExisting
      });
    }

    // Step 2: Increment counter and collision-check, retry up to 5 times
    const MAX_ATTEMPTS = 5;
    let finalId = null;
    let finalNorm = null;
    let finalValue = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const nextValue = (counter.current_value || 0) + 1;
      const candidateId = `S${yy}${String(nextValue).padStart(3, '0')}`;
      const candidateNorm = candidateId.toLowerCase();

      // Write the incremented value to counter
      await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: nextValue });
      // Refresh counter for next iteration if needed
      counter = { ...counter, current_value: nextValue };

      // Step 3: Collision check on student_id_norm (case-insensitive)
      const collision = await base44.asServiceRole.entities.Student.filter({
        student_id_norm: candidateNorm
      });

      if (collision.length === 0) {
        finalId = candidateId;
        finalNorm = candidateNorm;
        finalValue = nextValue;
        break;
      }

      // ID already in use (e.g. manually assigned) — bump counter and try next
      console.warn(`[generateStudentIdAuthoritative] Collision on ${candidateId}, trying next`);
    }

    if (!finalId) {
      return Response.json(
        { error: 'Failed to generate unique student ID after 5 attempts' },
        { status: 500 }
      );
    }

    return Response.json({
      student_id: finalId,
      student_id_norm: finalNorm,
      academic_year,
      counter_value: finalValue
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});