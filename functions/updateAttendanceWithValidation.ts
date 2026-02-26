import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attendanceId, data } = await req.json();

    if (!attendanceId || !data) {
      return Response.json(
        { error: 'attendanceId and data are required' },
        { status: 400 }
      );
    }

    // Fetch existing record
    const existingRecords = await base44.asServiceRole.entities.Attendance.filter({
      id: attendanceId
    });

    if (existingRecords.length === 0) {
      return Response.json({ error: 'Attendance record not found' }, { status: 404 });
    }

    const existingRecord = existingRecords[0];

    // Check if locked
    if (existingRecord.is_locked) {
      // Only admin can unlock and edit
      if (user.role !== 'admin') {
        return Response.json(
          { error: 'Record is locked. Only admin can unlock.' },
          { status: 403 }
        );
      }

      // Admin unlocking - create audit log
      const auditData = {
        action: 'unlock_and_edit',
        module: 'Attendance',
        date: existingRecord.date,
        performed_by: user.email,
        details: `Unlocked and edited attendance for student ${existingRecord.student_id} on ${existingRecord.date}. Changes: ${JSON.stringify(data)}`,
        academic_year: existingRecord.academic_year
      };

      await base44.asServiceRole.entities.AuditLog.create(auditData);
    }

    // Update the record
    await base44.asServiceRole.entities.Attendance.update(attendanceId, data);

    return Response.json({
      message: 'Attendance updated successfully',
      success: true
    });
  } catch (error) {
    console.error('Update attendance error:', error);
    return Response.json(
      { error: error.message || 'Failed to update attendance' },
      { status: 500 }
    );
  }
});