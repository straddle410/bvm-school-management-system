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
    const { student_id, academic_year } = await req.json();

    if (!student_id || !academic_year) {
      return Response.json({ data: { attendance_percentage: 0, present: 0, total: 0 } });
    }

    // Fetch current academic year dates
    const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year }).catch(() => []);
    const yearConfig = yearConfigs?.[0];
    
    const startDate = yearConfig?.start_date || new Date().toISOString().split('T')[0];
    const endDate = yearConfig?.end_date || new Date().toISOString().split('T')[0];

    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({
      student_id: student_id,
      academic_year: academic_year
    }).catch(() => []);

    if (!allAttendance || allAttendance.length === 0) {
      return Response.json({ data: { attendance_percentage: 0, present: 0, total: 0 } });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setUTCHours(0, 0, 0, 0);
    end.setUTCHours(23, 59, 59, 999);

    const recordsInRange = allAttendance.filter(a => {
      const attDate = new Date(a.date);
      attDate.setUTCHours(0, 0, 0, 0);
      return attDate >= start && attDate <= end;
    });

    if (!recordsInRange || recordsInRange.length === 0) {
      return Response.json({ data: { attendance_percentage: 0, present: 0, total: 0 } });
    }

    const uniqueWorkingDates = new Set();
    recordsInRange.forEach(a => {
      if (!a.is_holiday && a.attendance_type !== 'holiday') {
        uniqueWorkingDates.add(a.date);
      }
    });
    const workingDays = uniqueWorkingDates.size;

    const fullDayDates = new Set();
    const halfDayDates = new Set();
    
    recordsInRange.forEach(a => {
      if (!a.is_holiday && a.attendance_type !== 'holiday' && a.attendance_type !== 'absent') {
        if (a.attendance_type === 'full_day') {
          fullDayDates.add(a.date);
        } else if (a.attendance_type === 'half_day') {
          halfDayDates.add(a.date);
        }
      }
    });

    const fullDays = fullDayDates.size;
    const halfDays = halfDayDates.size;
    const totalPresent = fullDays + (halfDays * 0.5);
    const absentDays = workingDays - fullDays - halfDays;
    const percentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

    const months = [];
    let current = new Date(start);
    
    while (current <= end) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      monthStart.setUTCHours(0, 0, 0, 0);
      monthEnd.setUTCHours(23, 59, 59, 999);

      const periodStart = monthStart < start ? start : monthStart;
      const periodEnd = monthEnd > end ? end : monthEnd;

      const monthRecords = recordsInRange.filter(a => {
        const attDate = new Date(a.date);
        attDate.setUTCHours(0, 0, 0, 0);
        return attDate >= periodStart && attDate <= periodEnd;
      });

      const uniqueMonthWorkingDates = new Set();
      monthRecords.forEach(a => {
        if (!a.is_holiday && a.attendance_type !== 'holiday') {
          uniqueMonthWorkingDates.add(a.date);
        }
      });
      const monthWorkingDays = uniqueMonthWorkingDates.size;

      const monthFullDayDates = new Set();
      const monthHalfDayDates = new Set();
      
      monthRecords.forEach(a => {
        if (!a.is_holiday && a.attendance_type !== 'holiday' && a.attendance_type !== 'absent') {
          if (a.attendance_type === 'full_day') {
            monthFullDayDates.add(a.date);
          } else if (a.attendance_type === 'half_day') {
            monthHalfDayDates.add(a.date);
          }
        }
      });

      const monthFullDays = monthFullDayDates.size;
      const monthHalfDays = monthHalfDayDates.size;
      const monthTotalPresent = monthFullDays + (monthHalfDays * 0.5);
      const monthAbsent = monthWorkingDays - monthFullDays - monthHalfDays;
      const monthPercentage = monthWorkingDays > 0 ? Math.round((monthTotalPresent / monthWorkingDays) * 100) : 0;

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
        working_days: monthWorkingDays,
        full_days_present: monthFullDays,
        half_days_present: monthHalfDays,
        absent_days: monthAbsent,
        total_present: Math.round(monthTotalPresent * 100) / 100,
        attendance_percentage: monthPercentage
      });

      current.setMonth(current.getMonth() + 1);
    }

    return Response.json({
      range_start: startDate,
      range_end: endDate,
      working_days: workingDays,
      full_days_present: fullDays,
      half_days_present: halfDays,
      absent_days: absentDays,
      total_present_days: Math.round(totalPresent * 100) / 100,
      attendance_percentage: percentage,
      month_wise_breakdown: months
    });
  } catch (error) {
    console.error('Attendance summary calculation error:', error);
    return Response.json(
      { error: error.message || 'Failed to calculate attendance summary' },
      { status: 500 }
    );
  }
});