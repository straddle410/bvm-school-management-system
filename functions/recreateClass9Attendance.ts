import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete all existing class 9 attendance for 2024-25 (in chunks to avoid rate limiting)
    let allDeleted = 0;
    let hasMore = true;
    
    while (hasMore) {
      const existingAttendance = await base44.asServiceRole.entities.Attendance.filter({
        class_name: '9',
        academic_year: '2024-25'
      }, 'id', 50);

      if (existingAttendance.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`[DELETE] Batch deleting ${existingAttendance.length} records...`);
      for (const record of existingAttendance) {
        await base44.asServiceRole.entities.Attendance.delete(record.id);
      }
      allDeleted += existingAttendance.length;
    }
    
    console.log(`[DELETE] Total removed: ${allDeleted} attendance records`);

    // Fetch students in class 9
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: '9',
      academic_year: '2024-25'
    });

    console.log(`[STUDENTS] Found ${students.length} students in class 9`);

    // Generate attendance from 2025-11-01 to 2026-02-26
    const startDate = new Date('2025-11-01');
    const endDate = new Date('2026-02-26');
    const attendanceRecords = [];

    const current = new Date(startDate);
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0];
      const dayOfWeek = current.getDay();

      // Skip Sundays
      if (dayOfWeek !== 0) {
        students.forEach(student => {
          // Randomly assign attendance: 85% full_day, 8% half_day, 7% absent
          const rand = Math.random();
          let attendanceType = 'full_day';
          
          if (rand < 0.07) {
            attendanceType = 'absent';
          } else if (rand < 0.15) {
            attendanceType = 'half_day';
          }

          attendanceRecords.push({
            date: dateStr,
            class_name: '9',
            section: 'A',
            student_id: student.student_id || student.id,
            student_name: student.name,
            attendance_type: attendanceType,
            half_day_period: attendanceType === 'half_day' ? (Math.random() > 0.5 ? 'morning' : 'afternoon') : null,
            is_present: attendanceType !== 'absent',
            is_holiday: false,
            remarks: null,
            status: 'Approved',
            academic_year: '2024-25'
          });
        });
      }

      current.setDate(current.getDate() + 1);
    }

    console.log(`[CREATE] Generating ${attendanceRecords.length} new attendance records`);
    await base44.asServiceRole.entities.Attendance.bulkCreate(attendanceRecords);

    return Response.json({
      message: 'Successfully recreated class 9 attendance data',
      recordsDeleted: existingAttendance.length,
      recordsCreated: attendanceRecords.length,
      dateRange: { start: '2025-11-01', end: '2026-02-26' },
      studentCount: students.length
    });
  } catch (error) {
    console.error('[ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});