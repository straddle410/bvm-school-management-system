import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const students = await base44.asServiceRole.entities.Student.list('', 10000);

    let username_filled_count = 0;
    let skipped_custom_username_count = 0;
    const updates = [];

    for (const student of students) {
      // If username is missing/null/empty, set it to student_id (uppercase display)
      if (!student.username || student.username.trim() === '') {
        updates.push({
          id: student.id,
          username: student.student_id // use the uppercase student_id for display
        });
        username_filled_count++;
      } else {
        // Username exists and is custom — skip but count
        skipped_custom_username_count++;
      }
    }

    // Apply all updates
    for (const upd of updates) {
      await base44.asServiceRole.entities.Student.update(upd.id, {
        username: upd.username
      });
    }

    return Response.json({
      status: 'completed',
      total_students: students.length,
      username_filled_count,
      skipped_custom_username_count,
      updated_records_count: updates.length,
      note: 'Student login now uses student_id_norm (case-insensitive). Username field is for display only.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});