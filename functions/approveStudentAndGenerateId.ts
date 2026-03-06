import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * WORKAROUND for automation platform not triggering entity automations
 * This function:
 * 1. Approves a student (changes status to Approved)
 * 2. Generates the student ID, username, and password directly
 * 3. Tests the complete workflow without relying on broken automation trigger
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { student_id: studentRecordId } = await req.json();

    if (!studentRecordId) {
      return Response.json({ error: 'student_id (record ID) required in payload' }, { status: 400 });
    }

    // Fetch student
    const students = await base44.asServiceRole.entities.Student.filter({ id: studentRecordId });
    if (!students || students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const student = students[0];

    // Validate state
    if (student.student_id) {
      return Response.json({ error: 'Student already has an ID assigned' }, { status: 400 });
    }

    if (!student.academic_year) {
      return Response.json({ error: 'Student missing academic_year' }, { status: 400 });
    }

    // Change status to Approved
    await base44.asServiceRole.entities.Student.update(student.id, {
      status: 'Approved'
    });

    // Parse academic year
    const match = student.academic_year.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return Response.json({ error: 'Invalid academic_year format' }, { status: 400 });
    }

    const startYear = match[1];
    const yy = startYear.slice(2);
    const counterKey = `student_id_${startYear}`;

    // Scan for highest existing ID
    const allStudents = await base44.asServiceRole.entities.Student.filter({ 
      academic_year: student.academic_year,
      student_id: { $regex: `^S${yy}` }
    });
    
    const pattern = new RegExp(`^S${yy}(\\d{3})$`, 'i');
    const existing = allStudents
      .map(s => s.student_id)
      .filter(id => id && pattern.test(id))
      .map(id => {
        const m = id.match(/^S\d{2}(\d{3})$/i);
        return m ? parseInt(m[1], 10) : 0;
      });
    
    const maxExisting = existing.length > 0 ? Math.max(...existing) : 0;
    const nextValue = maxExisting + 1;

    // Get or create counter
    let counter = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
    counter = counter[0];

    if (!counter) {
      counter = await base44.asServiceRole.entities.Counter.create({
        key: counterKey,
        current_value: nextValue
      });
    } else {
      if (nextValue > (counter.current_value || 0)) {
        await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: nextValue });
      }
    }

    const finalId = `S${yy}${String(nextValue).padStart(3, '0')}`;
    const finalNorm = finalId.toLowerCase();

    // Dupe check
    const dupeCheck = await base44.asServiceRole.entities.Student.filter({
      student_id_norm: finalNorm
    });
    if (dupeCheck.length > 0) {
      return Response.json(
        { 
          error: 'Student ID collision detected',
          details: `${finalId} was assigned by another approval`
        },
        { status: 409 }
      );
    }

    // Generate password
    const tempPassword = `BVM${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Update student with all credentials
    await base44.asServiceRole.entities.Student.update(student.id, {
      student_id: finalId,
      student_id_norm: finalNorm,
      username: finalId,
      password: tempPassword,
      must_change_password: true
    });

    return Response.json({
      success: true,
      student_record_id: student.id,
      name: student.name,
      class: student.class_name,
      section: student.section,
      generated_student_id: finalId,
      generated_username: finalId,
      password_generated: true,
      must_change_password: true,
      status: 'Approved',
      message: `Successfully generated ID ${finalId} for ${student.name}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});