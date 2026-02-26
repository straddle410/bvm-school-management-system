import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentIds = ['STU111', 'STU112', 'STU113', 'STU114', 'STU115', 'STU116', 'STU117', 'STU118', 'STU119', 'STU120'];
    const studentNames = ['Uday Singh', 'Ujala Sharma', 'Ujas Patel', 'Ujwal Gupta', 'Ujwala Kapoor', 'Umed Kumar', 'Unmesha Joshi', 'Unnavi Khan', 'Unni Nair', 'Unnun Mishra'];
    
    const attendanceRecords = [];
    const startDate = new Date('2025-11-05');
    const endDate = new Date('2026-01-15');
    
    // Helper: check if date is weekday
    const isWeekday = (date) => {
      const day = date.getDay();
      return day !== 0 && day !== 6; // 0=Sunday, 6=Saturday
    };

    // Generate attendance for all students for all weekdays in range
    for (let currentDate = new Date(startDate); currentDate <= endDate; currentDate.setDate(currentDate.getDate() + 1)) {
      if (!isWeekday(currentDate)) continue; // Skip weekends
      
      const dateStr = currentDate.toISOString().split('T')[0];
      
      for (let i = 0; i < studentIds.length; i++) {
        const attendanceType = Math.random() > 0.15 ? 'full_day' : (Math.random() > 0.5 ? 'half_day' : 'absent');
        
        const record = {
          date: dateStr,
          class_name: '9',
          section: 'A',
          student_id: studentIds[i],
          student_name: studentNames[i],
          attendance_type: attendanceType,
          half_day_period: attendanceType === 'half_day' ? (Math.random() > 0.5 ? 'morning' : 'afternoon') : null,
          is_present: attendanceType !== 'absent',
          is_holiday: false,
          status: 'Approved',
          academic_year: '2024-25'
        };
        
        attendanceRecords.push(record);
      }
    }

    console.log(`Creating ${attendanceRecords.length} attendance records for 10 students from 5-11-2025 to 15-01-2026`);
    
    // Bulk create attendance records
    await base44.asServiceRole.entities.Attendance.bulkCreate(attendanceRecords);

    return Response.json({
      message: `Created ${attendanceRecords.length} attendance records for 10 students`,
      recordsCount: attendanceRecords.length,
      dateRange: {
        start: '2025-11-05',
        end: '2026-01-15'
      }
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message || 'Failed to create attendance data' }, { status: 500 });
  }
});