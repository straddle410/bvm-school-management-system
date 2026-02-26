import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can run migration
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Fetch all attendance records
    const allAttendance = await base44.asServiceRole.entities.Attendance.list();

    // Filter records that need migration (no attendance_type set, or only using is_present)
    const recordsToMigrate = allAttendance.filter(a => 
      !a.attendance_type || a.attendance_type === null
    );

    if (recordsToMigrate.length === 0) {
      return Response.json({
        message: 'No records need migration',
        migratedCount: 0
      });
    }

    const updatePromises = recordsToMigrate.map(record => {
      // Map is_present to attendance_type
      let newAttendanceType = 'full_day';
      if (record.is_holiday || record.attendance_type === 'holiday') {
        newAttendanceType = 'holiday';
      } else if (record.is_present === false) {
        newAttendanceType = 'absent';
      } else if (record.is_present === true) {
        newAttendanceType = 'full_day';
      }

      return base44.asServiceRole.entities.Attendance.update(record.id, {
        attendance_type: newAttendanceType
      });
    });

    await Promise.all(updatePromises);

    return Response.json({
      message: `Migrated ${recordsToMigrate.length} attendance records from is_present to attendance_type`,
      migratedCount: recordsToMigrate.length,
      details: `${recordsToMigrate.filter(r => !r.is_holiday && r.is_present === true).length} → full_day, ${recordsToMigrate.filter(r => r.is_present === false).length} → absent, ${recordsToMigrate.filter(r => r.is_holiday).length} → holiday`
    });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
});