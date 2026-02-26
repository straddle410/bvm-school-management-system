import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Delete all existing class 9 attendance for 2024-25
    console.log(`[DELETE] Clearing class 9 attendance...`);
    try {
      await base44.asServiceRole.entities.Attendance.deleteMany({
        class_name: '9',
        academic_year: '2024-25'
      });
      console.log('[DELETE] Deletion complete');
    } catch (e) {
      console.log('[DELETE] Error during deletion (may have already cleared):', e.message);
    }
    
    // Wait a moment before creating new records
    await new Promise(r => setTimeout(r, 2000));

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
    
    // Create in batches to avoid rate limiting
    const batchSize = 100;
    for (let i = 0; i < attendanceRecords.length; i += batchSize) {
      const batch = attendanceRecords.slice(i, i + batchSize);
      console.log(`[CREATE] Creating batch ${Math.floor(i / batchSize) + 1}...`);
      await base44.asServiceRole.entities.Attendance.bulkCreate(batch);
      // Wait between batches
      await new Promise(r => setTimeout(r, 500));
    }

    return Response.json({
      message: 'Successfully recreated class 9 attendance data',
      recordsCreated: attendanceRecords.length,
      dateRange: { start: '2025-11-01', end: '2026-02-26' },
      studentCount: students.length
    });
  } catch (error) {
    console.error('[ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});