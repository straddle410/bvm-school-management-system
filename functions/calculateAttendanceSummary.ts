import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function validateAcademicYearBoundary(date, academicYearStart, academicYearEnd) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const start = new Date(academicYearStart);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(academicYearEnd);
  end.setUTCHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, class_name, section, start_date, end_date, academic_year } = await req.json();

    if (!student_id || !class_name || !section || !start_date || !end_date) {
      return Response.json(
        { error: 'Missing required parameters: student_id, class_name, section, start_date, end_date' },
        { status: 400 }
      );
    }

    // ── ACADEMIC YEAR BOUNDARY CHECK ──
    if (academic_year) {
      const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year });
      if (yearConfigs.length > 0) {
        const yearConfig = yearConfigs[0];
        if (!validateAcademicYearBoundary(start_date, yearConfig.start_date, yearConfig.end_date)) {
          return Response.json({
            error: `Action not allowed outside selected Academic Year. Start date "${start_date}" is outside the ${academic_year} range (${yearConfig.start_date} to ${yearConfig.end_date}).`
          }, { status: 400 });
        }
        if (!validateAcademicYearBoundary(end_date, yearConfig.start_date, yearConfig.end_date)) {
          return Response.json({
            error: `Action not allowed outside selected Academic Year. End date "${end_date}" is outside the ${academic_year} range (${yearConfig.start_date} to ${yearConfig.end_date}).`
          }, { status: 400 });
        }
      }
    }

    const studentAttendance = await base44.asServiceRole.entities.Attendance.filter({
      student_id,
      class_name,
      section
    });

    const calculateAttendanceForRange = (records, startDate, endDate) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setUTCHours(0, 0, 0, 0);
      end.setUTCHours(23, 59, 59, 999);

      const allInRange = records.filter(a => {
        const attDate = new Date(a.date);
        attDate.setUTCHours(0, 0, 0, 0);
        return attDate >= start && attDate <= end;
      });

      // Use unique dates (same logic as progress card generation)
      const uniqueWorkingDates = new Set();
      const fullDayDates = new Set();
      const halfDayDates = new Set();

      allInRange.forEach(a => {
        if (!a.is_holiday && a.attendance_type !== 'holiday') {
          uniqueWorkingDates.add(a.date);
          if (a.attendance_type === 'full_day') fullDayDates.add(a.date);
          else if (a.attendance_type === 'half_day') halfDayDates.add(a.date);
        }
      });

      const workingDays = uniqueWorkingDates.size;
      const fullDays = fullDayDates.size;
      const halfDays = halfDayDates.size;
      const totalPresent = fullDays + (halfDays * 0.5);
      const percentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

      return {
        working_days: workingDays,
        full_days_present: fullDays,
        half_days_present: halfDays,
        total_present_days: Math.round(totalPresent * 100) / 100,
        attendance_percentage: percentage
      };
    };

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

        const allMonthRecords = records.filter(a => {
          const attDate = new Date(a.date);
          attDate.setUTCHours(0, 0, 0, 0);
          return attDate >= periodStart && attDate <= periodEnd;
        });

        const presentMonthRecords = allMonthRecords.filter(a => 
          !a.is_holiday && a.attendance_type !== 'holiday' && a.attendance_type !== 'absent'
        );

        const fullDays = presentMonthRecords.filter(a => a.attendance_type === 'full_day').length;
        const halfDays = presentMonthRecords.filter(a => a.attendance_type === 'half_day').length;
        const totalPresent = fullDays + (halfDays * 0.5);

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

    if (studentAttendance.length === 0) {
      return Response.json({ attendance_summary: null });
    }

    const rangeAttendance = calculateAttendanceForRange(studentAttendance, start_date, end_date);
    const monthWiseBreakdown = getMonthWiseBreakdown(studentAttendance, start_date, end_date);

    const attendanceSummary = {
      range_start: start_date,
      range_end: end_date,
      ...rangeAttendance,
      month_wise_breakdown: monthWiseBreakdown
    };

    return Response.json({ attendance_summary: attendanceSummary });
  } catch (error) {
    return Response.json(
      { error: error.message || 'Failed to calculate attendance summary' },
      { status: 500 }
    );
  }
});