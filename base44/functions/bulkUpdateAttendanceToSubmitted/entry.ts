import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    // Fetch ALL attendance records
    const allAttendance = await base44.asServiceRole.entities.Attendance.list();

    if (allAttendance.length === 0) {
      return Response.json({
        message: 'No attendance records found',
        updated: 0
      });
    }

    // Update all records to "Submitted" status
    let updateCount = 0;
    for (const record of allAttendance) {
      await base44.asServiceRole.entities.Attendance.update(record.id, {
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
        marked_by: 'SYSTEM'
      });
      updateCount++;
    }

    return Response.json({
      message: `Successfully updated ${updateCount} attendance records to Submitted status`,
      updated: updateCount,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error bulk updating attendance:', error);
    return Response.json(
      { error: error.message || 'Failed to bulk update attendance' },
      { status: 500 }
    );
  }
});