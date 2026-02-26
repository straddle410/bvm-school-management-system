import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all attendance for class 9, 2024-25
    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({
      class_name: '9',
      academic_year: '2024-25'
    });

    console.log(`[DEDUP] Processing ${allAttendance.length} attendance records`);

    // Group by (student_id, date) to find duplicates
    const groupedByStudentDate = {};
    const duplicates = [];

    allAttendance.forEach(record => {
      const key = `${record.student_id}__${record.date}`;
      if (!groupedByStudentDate[key]) {
        groupedByStudentDate[key] = [];
      }
      groupedByStudentDate[key].push(record);
    });

    // Find groups with multiple records
    Object.entries(groupedByStudentDate).forEach(([key, records]) => {
      if (records.length > 1) {
        duplicates.push({ key, records, count: records.length });
        console.log(`[DEDUP-FOUND] ${key}: ${records.length} records`);
      }
    });

    console.log(`[DEDUP] Found ${duplicates.length} duplicate groups`);

    // For each duplicate group, keep the best record and delete others
    let deletedCount = 0;
    const consolidationLog = [];

    for (const { key, records } of duplicates) {
      // Prioritize: full_day > half_day > absent > holiday
      const priority = (r) => {
        if (r.attendance_type === 'full_day') return 3;
        if (r.attendance_type === 'half_day') return 2;
        if (r.attendance_type === 'absent') return 1;
        return 0;
      };

      records.sort((a, b) => priority(b) - priority(a));
      const keeper = records[0];
      const toDelete = records.slice(1);

      consolidationLog.push({
        key,
        keeper: { date: keeper.date, type: keeper.attendance_type, id: keeper.id },
        deleted: toDelete.map(r => ({ type: r.attendance_type, id: r.id }))
      });

      // Delete lower-priority duplicates
      for (const record of toDelete) {
        await base44.asServiceRole.entities.Attendance.delete(record.id);
        deletedCount++;
      }
    }

    console.log(`[DEDUP] Deleted ${deletedCount} duplicate records`);

    return Response.json({
      message: `Deduplication complete`,
      duplicateGroupsFound: duplicates.length,
      recordsDeleted: deletedCount,
      consolidationLog: consolidationLog.slice(0, 10) // Show first 10 for reference
    });
  } catch (error) {
    console.error('[DEDUP-ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});