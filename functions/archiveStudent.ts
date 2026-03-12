import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, academic_year, staffInfo } = await req.json();
    const user = staffInfo || { email: 'system' };
    if (staffInfo && !['admin', 'principal'].includes((staffInfo.role || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (!student_id || !academic_year) {
      return Response.json({ error: 'Missing student_id or academic_year' }, { status: 400 });
    }

    // Find the student
    const students = await base44.asServiceRole.entities.Student.filter({
      student_id,
      academic_year
    });

    if (!students || students.length === 0) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentRecord = students[0];

    // Archive the student record
    await base44.asServiceRole.entities.Student.update(studentRecord.id, {
      is_active: false,
      is_deleted: true,
      status: 'Archived',
      archived_at: new Date().toISOString(),
      archived_by: user.email
    });

    return Response.json({
      success: true,
      message: `Student ${student_id} has been archived`,
      student_id,
      archived_at: new Date().toISOString()
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});