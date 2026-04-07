import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    // Find all unsubmitted attendance for Class 1
    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({
      class_name: '1'
    });

    const unsubmittedRecords = allAttendance.filter(a => a.status === 'Taken');

    if (unsubmittedRecords.length === 0) {
      return Response.json({
        message: 'No unsubmitted attendance records found for Class 1',
        submitted: 0
      });
    }

    // Update all unsubmitted records to "Submitted"
    const updates = unsubmittedRecords.map(record => ({
      ...record,
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
      marked_by: user.email || 'SYSTEM'
    }));

    // Bulk update
    for (const record of updates) {
      await base44.asServiceRole.entities.Attendance.update(record.id, {
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
        marked_by: user.email || 'SYSTEM'
      });
    }

    return Response.json({
      message: `Successfully submitted ${unsubmittedRecords.length} attendance records for Class 1`,
      submitted: unsubmittedRecords.length,
      submittedAt: new Date().toISOString(),
      submittedBy: user.email
    });
  } catch (error) {
    console.error('Error submitting attendance:', error);
    return Response.json(
      { error: error.message || 'Failed to submit attendance' },
      { status: 500 }
    );
  }
});