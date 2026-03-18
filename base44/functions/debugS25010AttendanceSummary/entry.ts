import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all attendance records
    const allRecords = await base44.asServiceRole.entities.Attendance.filter({
      student_id: 'S25010',
      academic_year: '2025-26'
    });

    // Fetch academic year config
    const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({
      year: '2025-26'
    });
    const yearConfig = yearConfigs?.[0];
    const startDate = yearConfig?.start_date;
    const endDate = yearConfig?.end_date;

    // Filter by date range
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    const recordsInRange = allRecords.filter(a => {
      const attDate = new Date(a.date);
      attDate.setUTCHours(0, 0, 0, 0);
      return attDate >= start && attDate <= end;
    });

    // Count by type
    const byType = {};
    recordsInRange.forEach(r => {
      if (!byType[r.attendance_type]) {
        byType[r.attendance_type] = [];
      }
      byType[r.attendance_type].push(r.date);
    });

    return Response.json({
      total_records_in_range: recordsInRange.length,
      by_type: byType,
      count_summary: Object.fromEntries(
        Object.entries(byType).map(([type, dates]) => [
          type,
          { count: dates.length, unique_dates: new Set(dates).size }
        ])
      )
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});