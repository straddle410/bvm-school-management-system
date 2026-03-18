import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { academicYear } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'Academic year is required' }, { status: 400 });
    }

    // Fetch all students for the academic year
    const students = await base44.asServiceRole.entities.Student.filter({
      academic_year: academicYear
    });

    // Fetch exam types to get attendance ranges
    const examTypes = await base44.asServiceRole.entities.ExamType.filter({
      academic_year: academicYear
    });

    const examTypesWithRange = examTypes.filter(e => e.attendance_range_start && e.attendance_range_end);

    if (examTypesWithRange.length === 0) {
      return Response.json({ message: 'No exam types with attendance ranges found', recordsGenerated: 0 });
    }

    // Use the date range from the most recent exam type
    const examType = examTypesWithRange.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
    const startDate = new Date(examType.attendance_range_start);
    const endDate = new Date(examType.attendance_range_end);

    const attendanceRecords = [];

    // Generate attendance for each student for each working day in the range
    students.forEach(student => {
      let current = new Date(startDate);
      
      while (current <= endDate) {
        // Skip weekends (Saturday=6, Sunday=0)
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
          // Generate attendance: 85% present, 10% half-day, 5% absent
          const random = Math.random();
          let attendanceType = 'full_day';
          
          if (random < 0.05) {
            attendanceType = 'absent';
          } else if (random < 0.15) {
            attendanceType = 'half_day';
          }

          attendanceRecords.push({
            date: current.toISOString().split('T')[0],
            class_name: student.class_name,
            section: student.section,
            student_id: student.id,
            student_name: student.name,
            attendance_type: attendanceType,
            half_day_period: attendanceType === 'half_day' ? (Math.random() > 0.5 ? 'morning' : 'afternoon') : null,
            is_present: attendanceType !== 'absent',
            is_holiday: false,
            status: 'Published',
            academic_year: academicYear
          });
        }
        
        current.setDate(current.getDate() + 1);
      }
    });

    // Bulk create attendance records
    if (attendanceRecords.length > 0) {
      await base44.asServiceRole.entities.Attendance.bulkCreate(attendanceRecords);
    }

    return Response.json({
      message: `Generated ${attendanceRecords.length} attendance records for ${students.length} students`,
      recordsGenerated: attendanceRecords.length
    });
  } catch (error) {
    console.error('Sample attendance generation error:', error);
    return Response.json(
      { error: error.message || 'Failed to generate sample attendance' },
      { status: 500 }
    );
  }
});