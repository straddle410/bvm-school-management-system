import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date, studentId, classname, section, academicYear } = await req.json();

    if (!date || !studentId || !classname || !section || !academicYear) {
      return Response.json(
        { error: 'date, studentId, classname, section, and academicYear are required' },
        { status: 400 }
      );
    }

    // Check for existing record with same student + date
    const existingRecords = await base44.asServiceRole.entities.Attendance.filter({
      date,
      student_id: studentId,
      class_name: classname,
      section,
      academic_year: academicYear
    });

    if (existingRecords.length > 0) {
      // Record exists - this is an update, not a create
      return Response.json({
        isDuplicate: false,
        existingRecordId: existingRecords[0].id,
        message: 'Record exists - this will be an update operation'
      });
    }

    // No duplicate found - safe to create
    return Response.json({
      isDuplicate: false,
      canCreate: true,
      message: 'No duplicate found - safe to create'
    });
  } catch (error) {
    console.error('Deduplication check error:', error);
    return Response.json(
      { error: error.message || 'Deduplication check failed' },
      { status: 500 }
    );
  }
});