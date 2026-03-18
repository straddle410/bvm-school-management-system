import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { student_id = 'S25010', academic_year = '2025-26' } = body;

    // Fetch all absent records for student
    const absentRecords = await base44.asServiceRole.entities.Attendance.filter({
      student_id,
      academic_year,
      attendance_type: 'absent'
    });

    // Group by date to find duplicates
    const byDate = {};
    absentRecords.forEach(record => {
      if (!byDate[record.date]) {
        byDate[record.date] = [];
      }
      byDate[record.date].push(record);
    });

    // Find and delete duplicates, keeping the first one
    const duplicatesDeleted = [];
    for (const date in byDate) {
      const records = byDate[date];
      if (records.length > 1) {
        // Keep first, delete rest
        for (let i = 1; i < records.length; i++) {
          await base44.asServiceRole.entities.Attendance.delete(records[i].id);
          duplicatesDeleted.push({
            date,
            deleted_id: records[i].id,
            kept_id: records[0].id
          });
        }
      }
    }

    return Response.json({
      success: true,
      student_id,
      total_absent_records_before: absentRecords.length,
      unique_dates: Object.keys(byDate).length,
      duplicates_deleted: duplicatesDeleted.length,
      details: duplicatesDeleted
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});