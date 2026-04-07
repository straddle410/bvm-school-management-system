/**
 * Shared attendance calculation logic for Progress Cards and Attendance Summary.
 * Calculates working days from calendar (excluding holidays/Sundays).
 * Missing attendance records default to "present".
 */
async function calculateAttendanceSummaryWithDefaults(
  base44,
  studentAttendance,
  startDate,
  endDate,
  className,
  section,
  academicYear
) {
  const holidays = await base44.asServiceRole.entities.Holiday.filter({ academic_year: academicYear });
  const overrides = await base44.asServiceRole.entities.HolidayOverride.filter({ 
    class_name: className, 
    section, 
    academic_year: academicYear 
  });

  const isWorkingDay = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) return false;
    const holiday = holidays.find(h => h.date === dateStr && h.status === 'Active');
    if (holiday) {
      const override = overrides.find(o => o.date === dateStr && o.class_name === className && o.section === section);
      return !!override;
    }
    return true;
  };

  const attendanceMap = {};
  studentAttendance.forEach(a => {
    if (a.date >= startDate && a.date <= endDate && (a.status === 'Submitted' || a.status === 'Approved' || a.auto_submitted === true)) {
      attendanceMap[a.date] = a;
    }
  });

  const workingDates = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);

  let current = new Date(start);
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    if (isWorkingDay(dateStr)) {
      workingDates.push(dateStr);
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  const fullDayDates = new Set();
  const halfDayDates = new Set();
  const absentDayDates = new Set();

  workingDates.forEach(dateStr => {
    const record = attendanceMap[dateStr];
    if (!record) {
      fullDayDates.add(dateStr);
    } else if (record.attendance_type === 'full_day') {
      fullDayDates.add(dateStr);
    } else if (record.attendance_type === 'half_day') {
      halfDayDates.add(dateStr);
    } else if (record.attendance_type === 'absent') {
      absentDayDates.add(dateStr);
    }
  });

  const workingDays = workingDates.length;
  const fullDays = fullDayDates.size;
  const halfDays = halfDayDates.size;
  const absentDays = absentDayDates.size;
  const totalPresent = fullDays + (halfDays * 0.5);
  const percentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

  return {
    working_days: workingDays,
    full_days_present: fullDays,
    half_days_present: halfDays,
    absent_days: absentDays,
    total_present_days: Math.round(totalPresent * 100) / 100,
    attendance_percentage: percentage,
    workingDates
  };
}

async function getMonthWiseBreakdownWithDefaults(
  base44,
  studentAttendance,
  startDate,
  endDate,
  className,
  section,
  academicYear
) {
  const holidays = await base44.asServiceRole.entities.Holiday.filter({ academic_year: academicYear });
  const overrides = await base44.asServiceRole.entities.HolidayOverride.filter({ 
    class_name: className, 
    section, 
    academic_year: academicYear 
  });

  const isWorkingDay = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) return false;
    const holiday = holidays.find(h => h.date === dateStr && h.status === 'Active');
    if (holiday) {
      const override = overrides.find(o => o.date === dateStr && o.class_name === className && o.section === section);
      return !!override;
    }
    return true;
  };

  const attendanceMap = {};
  studentAttendance.forEach(a => {
    if (a.date >= startDate && a.date <= endDate && (a.status === 'Submitted' || a.status === 'Approved' || a.auto_submitted === true)) {
      attendanceMap[a.date] = a;
    }
  });

  const months = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);

  let current = new Date(start);
  while (current <= end) {
    const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
    const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
    monthStart.setUTCHours(0, 0, 0, 0);
    monthEnd.setUTCHours(23, 59, 59, 999);

    const periodStart = monthStart < start ? start : monthStart;
    const periodEnd = monthEnd > end ? end : monthEnd;

    const monthWorkingDates = [];
    let monthCurrent = new Date(periodStart);
    while (monthCurrent <= periodEnd) {
      const dateStr = monthCurrent.toISOString().split('T')[0];
      if (isWorkingDay(dateStr)) {
        monthWorkingDates.push(dateStr);
      }
      monthCurrent.setUTCDate(monthCurrent.getUTCDate() + 1);
    }

    const mFullDates = new Set();
    const mHalfDates = new Set();
    const mAbsentDates = new Set();

    monthWorkingDates.forEach(dateStr => {
      const record = attendanceMap[dateStr];
      if (!record) {
        mFullDates.add(dateStr);
      } else if (record.attendance_type === 'full_day') {
        mFullDates.add(dateStr);
      } else if (record.attendance_type === 'half_day') {
        mHalfDates.add(dateStr);
      } else if (record.attendance_type === 'absent') {
        mAbsentDates.add(dateStr);
      }
    });

    const mWorking = monthWorkingDates.length;
    const mFull = mFullDates.size;
    const mHalf = mHalfDates.size;
    const mAbsent = mAbsentDates.size;
    const mPresent = mFull + (mHalf * 0.5);
    const mPct = mWorking > 0 ? Math.round((mPresent / mWorking) * 100) : 0;

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
      working_days: mWorking,
      full_days_present: mFull,
      half_days_present: mHalf,
      absent_days: mAbsent,
      present_days: Math.round(mPresent * 100) / 100,
      total_present: Math.round(mPresent * 100) / 100,
      attendance_percentage: mPct
    });

    current.setMonth(current.getMonth() + 1);
  }

  return months;
}

export { calculateAttendanceSummaryWithDefaults, getMonthWiseBreakdownWithDefaults };