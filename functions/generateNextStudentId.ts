import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { academicYear } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'Academic year is required' }, { status: 400 });
    }

    // Extract year prefix from academic year (e.g., "2025-26" → "25", "2026-27" → "26")
    const yearPrefix = academicYear.substring(2, 4);
    const idPrefix = `S${yearPrefix}`;

    // Fetch all students for this academic year
    const students = await base44.asServiceRole.entities.Student.filter({
      academic_year: academicYear
    });
    
    let maxNumber = 0;
    
    students.forEach(student => {
      if (student.student_id && student.student_id.startsWith(idPrefix)) {
        const numPart = parseInt(student.student_id.substring(idPrefix.length));
        if (!isNaN(numPart) && numPart > maxNumber) {
          maxNumber = numPart;
        }
      }
    });

    const nextSequence = maxNumber + 1;
    const nextId = `${idPrefix}${String(nextSequence).padStart(3, '0')}`;
    
    return Response.json({ 
      next_student_id: nextId,
      message: `Next student ID for ${academicYear} will be ${nextId}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});