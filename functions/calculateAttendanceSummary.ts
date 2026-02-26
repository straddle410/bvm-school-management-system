import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, class_name, section, start_date, end_date } = await req.json();

    // Validate required parameters
    if (!student_id || !class_name || !section || !start_date || !end_date) {
      return Response.json(
        { error: 'Missing required parameters: student_id, class_name, section, start_date, end_date' },
        { status: 400 }
      );
    }

    // Fetch attendance records for the student
    const studentAttendance = await base44.asServiceRole.entities.Attendance.filter({
      student_id,
      class_name,
      section
    });

    // Helper function to calculate attendance for a date range
    const calculateAttendanceForRange = (records, startDate, endDate) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);

      // Include ALL records in range (holidays, absents, present) to calculate working days
      const allInRange = records.filter(a => {
        const attDate = new Date(a.date);
        attDate.setUTCHours(0, 0, 0, 0);
        return attDate >= start && attDate <= end;
      });

      // Only non-holiday, non-absent records count toward attendance
      const presentRecords = allInRange.filter(a => 
        !a.is_holiday && a.attendance_type !== 'holiday' && a.attendance_type !== 'absent'
      );

      const fullDays = presentRecords.filter(a => a.attendance_type === 'full_day').length;
      const halfDays = presentRecords.filter(a => a.attendance_type === 'half_day').length;
      const totalPresent = fullDays + (halfDays * 0.5);

      // Working days = all records excluding holidays
      const workingDays = allInRange.filter(a => 
        !a.is_holiday && a.attendance_type !== 'holiday'
      ).length;

      const percentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

      return {
        working_days: workingDays,
        full_days_present: fullDays,
        half_days_present: halfDays,
        total_present_days: Math.round(totalPresent * 100) / 100,
        attendance_percentage: percentage
      };
    };

    // Helper to get month-wise breakdown
    const getMonthWiseBreakdown = (records, startDate, endDate) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);
      const months = [];

      let current = new Date(start);
      while (current <= end) {
        const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        monthStart.setUTCHours(0, 0, 0, 0);
        monthEnd.setUTCHours(23, 59, 59, 999);

        const periodStart = monthStart < start ? start : monthStart;
        const periodEnd = monthEnd > end ? end : monthEnd;

        // Include ALL records in period to count working days
        const allMonthRecords = records.filter(a => {
          const attDate = new Date(a.date);
          attDate.setUTCHours(0, 0, 0, 0);
          return attDate >= periodStart && attDate <= periodEnd;
        });

        // Only non-holiday, non-absent records count toward attendance
        const presentMonthRecords = allMonthRecords.filter(a => 
          !a.is_holiday && a.attendance_type !== 'holiday' && a.attendance_type !== 'absent'
        );

        const fullDays = presentMonthRecords.filter(a => a.attendance_type === 'full_day').length;
        const halfDays = presentMonthRecords.filter(a => a.attendance_type === 'half_day').length;
        const totalPresent = fullDays + (halfDays * 0.5);

        // Working days = exclude holidays
        const workingDays = allMonthRecords.filter(a => 
          !a.is_holiday && a.attendance_type !== 'holiday'
        ).length;

        const percentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthName = monthNames[current.getMonth()];
        let displayText = monthName;
        
        if (periodStart.getMonth() === periodEnd.getMonth()) {
          if (periodStart.getDate() !== 1 || periodEnd.getDate() !== new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0).getDate()) {
            displayText = `${monthName} (${periodStart.getDate()}–${periodEnd.getDate()})`;
          }
        }

        months.push({
          month: monthName,
          year: current.getFullYear(),
          month_display: displayText,
          period_start: periodStart.toISOString().split('T')[0],
          period_end: periodEnd.toISOString().split('T')[0],
          working_days: workingDays,
          full_days_present: fullDays,
          half_days_present: halfDays,
          total_present: Math.round(totalPresent * 100) / 100,
          attendance_percentage: percentage
        });

        current.setMonth(current.getMonth() + 1);
      }
      
      return months;
    };

    // Only calculate if we have records in the range
    if (studentAttendance.length === 0) {
      return Response.json({
        attendance_summary: null
      });
    }

    const rangeAttendance = calculateAttendanceForRange(studentAttendance, start_date, end_date);
    const monthWiseBreakdown = getMonthWiseBreakdown(studentAttendance, start_date, end_date);

    const attendanceSummary = {
      range_start: start_date,
      range_end: end_date,
      ...rangeAttendance,
      month_wise_breakdown: monthWiseBreakdown
    };

    return Response.json({
      attendance_summary: attendanceSummary
    });
  } catch (error) {
    return Response.json(
      { error: error.message || 'Failed to calculate attendance summary' },
      { status: 500 }
    );
  }
});