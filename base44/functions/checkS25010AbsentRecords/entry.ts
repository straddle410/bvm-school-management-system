import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all absent records for S25010
    const absentRecords = await base44.asServiceRole.entities.Attendance.filter({
      student_id: 'S25010',
      academic_year: '2025-26',
      attendance_type: 'absent'
    });

    // Group by date
    const byDate = {};
    absentRecords.forEach(record => {
      if (!byDate[record.date]) {
        byDate[record.date] = [];
      }
      byDate[record.date].push(record.id);
    });

    // Count duplicates
    let duplicateCount = 0;
    const duplicateDates = [];
    for (const date in byDate) {
      if (byDate[date].length > 1) {
        duplicateCount += byDate[date].length - 1;
        duplicateDates.push({
          date,
          count: byDate[date].length,
          ids: byDate[date]
        });
      }
    }

    return Response.json({
      total_absent_records: absentRecords.length,
      unique_dates: Object.keys(byDate).length,
      duplicate_records_found: duplicateCount,
      duplicate_details: duplicateDates
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});