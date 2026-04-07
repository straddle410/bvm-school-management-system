import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized — admin access required' }, { status: 403 });
    }

    const { start_date, end_date } = await req.json();

    // Find all unsubmitted attendance for Class 1
    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({
      class_name: '1'
    });

    let targetRecords = allAttendance;
    
    // Filter by date range if provided
    if (start_date && end_date) {
      targetRecords = targetRecords.filter(a => a.date >= start_date && a.date <= end_date);
    }

    if (targetRecords.length === 0) {
      return Response.json({
        message: 'No attendance records found for Class 1' + (start_date && end_date ? ` between ${start_date} and ${end_date}` : ''),
        submitted: 0
      });
    }

    // Update all records to "Submitted" status
    for (const record of targetRecords) {
      await base44.asServiceRole.entities.Attendance.update(record.id, {
        status: 'Submitted',
        submitted_at: new Date().toISOString(),
        marked_by: user.email || 'SYSTEM'
      });
    }

    return Response.json({
      message: `Successfully submitted ${targetRecords.length} attendance records for Class 1` + (start_date && end_date ? ` between ${start_date} and ${end_date}` : ''),
      submitted: targetRecords.length,
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