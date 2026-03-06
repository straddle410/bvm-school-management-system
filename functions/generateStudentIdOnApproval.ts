import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    
    // From automation trigger: { event, data, old_data }
    const { event, data, old_data } = payload;
    
    console.log('[AUTOMATION] Payload received:', {
      event_type: event?.type,
      event_entity_name: event?.entity_name,
      has_data: !!data,
      has_old_data: !!old_data,
      data_status: data?.status,
      data_student_id: data?.student_id,
      old_data_status: old_data?.status
    });
    
    if (event?.type !== 'update' || !data) {
      console.log('[AUTOMATION] Skipping: Not an update event or no data');
      return Response.json({ message: 'Not a student update event' }, { status: 200 });
    }

    const student = data;
    
    console.log('[AUTOMATION] Student data:', {
      id: student.id,
      name: student.name,
      status: student.status,
      student_id: student.student_id,
      academic_year: student.academic_year
    });
    
    // Only process if status changed TO "Approved" and student_id is NULL
    if (student.status !== 'Approved' || student.student_id) {
      console.log('[AUTOMATION] Skipping: Status not Approved or ID already exists', {
        status_is_approved: student.status === 'Approved',
        student_id_is_null: student.student_id === null
      });
      return Response.json({ message: 'No ID generation needed', reason: 'Status not Approved or ID exists' }, { status: 200 });
    }
    
    console.log('[AUTOMATION] Proceeding with ID generation');

    if (!student.academic_year) {
      return Response.json({ error: 'Student missing academic_year' }, { status: 400 });
    }

    // Parse academic year
    const match = student.academic_year.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return Response.json({ error: 'Invalid academic_year format' }, { status: 400 });
    }

    const startYear = match[1];
    const yy = startYear.slice(2);
    const counterKey = `student_id_${startYear}`;

    // ALWAYS scan for highest existing ID to prevent gaps
    // Counter stores the highest ID number ever issued, NOT a sequential counter
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

    // Get or create counter for this year (stores highest issued ID number)
    let counter = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
    counter = counter[0];

    if (!counter) {
      // First student of this year — create counter with next value
      counter = await base44.asServiceRole.entities.Counter.create({
        key: counterKey,
        current_value: nextValue
      });
    } else {
      // Update counter to new highest if needed
      if (nextValue > (counter.current_value || 0)) {
        await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: nextValue });
      }
    }

    const finalId = `S${yy}${String(nextValue).padStart(3, '0')}`;
    const finalNorm = finalId.toLowerCase();

    // Double-check uniqueness (race condition safety)
    const dupeCheck = await base44.asServiceRole.entities.Student.filter({
      student_id_norm: finalNorm
    });
    if (dupeCheck.length > 0) {
      return Response.json(
        { 
          error: 'Student ID collision detected after generation',
          details: `${finalId} was assigned by another approval while this one was processing`
        },
        { status: 409 }
      );
    }

    // Generate password
    const tempPassword = `BVM${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Update student with ID, username, and password
    await base44.asServiceRole.entities.Student.update(student.id, {
      student_id: finalId,
      student_id_norm: finalNorm,
      username: finalId,
      password: tempPassword,
      must_change_password: true
    });

    return Response.json({
      success: true,
      student_id: finalId,
      student_name: student.name,
      class: student.class_name,
      section: student.section,
      message: `Generated ID ${finalId} for ${student.name}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});