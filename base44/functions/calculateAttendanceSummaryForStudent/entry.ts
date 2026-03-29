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

// Helper: Check if day is a working day (excludes only Sundays and marked holidays)
function isWorkingDay(date, holidays, overrides) {
  const dayOfWeek = new Date(date + 'T00:00:00').getDay();
  // Sunday = 0, Saturdays = 6 ARE working days
  const isSunday = dayOfWeek === 0;
  const isHoliday = holidays.some(h => h.date === date);
  const hasOverride = overrides.some(o => o.date === date);
  // Holiday override takes precedence — it enables working day
  if (hasOverride) return true;
  return !isSunday && !isHoliday; // Working if not Sunday and not marked holiday
}

// CANONICAL DEDUPLICATION - Same logic as Summary Report
function deduplicateAttendanceRecords(records) {
  if (!records || records.length === 0) return [];
  const dateMap = {};
  records.forEach(r => {
    if (!dateMap[r.date]) {
      dateMap[r.date] = r;
    } else {
      // Precedence: full_day > half_day > absent > holiday
      const existing = dateMap[r.date];
      const priority = { full_day: 4, half_day: 3, absent: 2, holiday: 1 };
      if ((priority[r.attendance_type] || 0) > (priority[existing.attendance_type] || 0)) {
        dateMap[r.date] = r;
      }
    }
  });
  return Object.values(dateMap);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, academic_year, start_date, end_date } = await req.json();

    if (!student_id || !academic_year) {
      return Response.json({ working_days: 0, present_days: 0, absent_days: 0, percentage: 0 });
    }

    // Fetch student to determine attendance start date
    const student = await base44.asServiceRole.entities.Student.filter({ student_id: student_id }).catch(() => null);
    const studentRecord = student?.[0];

    // Determine attendance start date: use admission_date if available, otherwise academic year start
    let startDate = start_date;
    let endDate = end_date;
    let effectiveStudentStartDate = null;
    
    if (!startDate || !endDate) {
      const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year }).catch(() => []);
      const yearConfig = yearConfigs?.[0];
      const academicYearStart = yearConfig?.start_date || new Date().toISOString().split('T')[0];
      
      // Determine student's effective start date for attendance
      if (studentRecord?.admission_date) {
        effectiveStudentStartDate = studentRecord.admission_date;
      } else {
        effectiveStudentStartDate = academicYearStart;
      }
      
      startDate = start_date || effectiveStudentStartDate;
      endDate = end_date || yearConfig?.end_date || new Date().toISOString().split('T')[0];
    } else if (!effectiveStudentStartDate) {
      // If dates are passed, also set effective start date
      if (studentRecord?.admission_date) {
        effectiveStudentStartDate = studentRecord.admission_date;
      } else {
        effectiveStudentStartDate = start_date;
      }
    }

    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({
      student_id: student_id,
      academic_year: academic_year
    }).catch(() => []);

    // Fetch holiday overrides to check for override days
    const allOverrides = await base44.asServiceRole.entities.HolidayOverride.filter({
      academic_year: academic_year
    }).catch(() => []);

    // Use effective student start date (admission_date or academic year start)
    const effectiveStart = new Date(effectiveStudentStartDate || startDate);
    effectiveStart.setUTCHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setUTCHours(23, 59, 59, 999);

    // Build list of all calendar days in range (used for working day calculation)
    const daysBetween = [];
    let current = new Date(effectiveStart);
    while (current <= end) {
      daysBetween.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Deduplicate records and create date map
    const dedupedAttendance = deduplicateAttendanceRecords(allAttendance);
    const recordsInRange = dedupedAttendance.filter(a => {
      const attDate = new Date(a.date);
      attDate.setUTCHours(0, 0, 0, 0);
      return attDate >= effectiveStart && attDate <= end;
    });

    // Create date map for submitted attendance
    const submittedDates = new Map();
    recordsInRange.forEach(a => {
      if (!submittedDates.has(a.date)) {
        submittedDates.set(a.date, a);
      }
    });

    // Fetch holidays and holiday overrides
    const holidays = await base44.asServiceRole.entities.Holiday.filter({ academic_year: academic_year, status: 'Active' }).catch(() => []);
    const overrides = allOverrides.filter(o => o.class_name === recordsInRange[0]?.class_name && o.section === recordsInRange[0]?.section);
    
    // Calculate working days: all days that are NOT (Sunday OR marked holiday) AND NOT overridden
    const workingDays = daysBetween.filter(d => isWorkingDay(d, holidays, overrides)).length;

    // Count present/absent: 
    // - Days WITH submitted attendance: use submitted status
    // - Days WITHOUT submitted attendance: treat as PRESENT (user's rule)
    const workingDaysSet = new Set(daysBetween.filter(d => isWorkingDay(d, holidays, overrides)));

    const fullDayDates = new Set();
    const halfDayDates = new Set();
    const absentDates = new Set();
    
    recordsInRange.forEach(a => {
      if (!a.is_holiday && a.attendance_type !== 'holiday' && workingDaysSet.has(a.date)) {
        if (a.attendance_type === 'full_day') {
          fullDayDates.add(a.date);
        } else if (a.attendance_type === 'half_day') {
          halfDayDates.add(a.date);
        } else if (a.attendance_type === 'absent') {
          absentDates.add(a.date);
        }
      }
    });

    // Count unsubmitted working days as PRESENT (user's rule)
    const submittedWorkingDays = new Set();
    recordsInRange.forEach(a => {
      if (workingDaysSet.has(a.date)) submittedWorkingDays.add(a.date);
    });
    const unsubmittedWorkingDays = Array.from(workingDaysSet).filter(d => !submittedWorkingDays.has(d)).length;

    const fullDays = fullDayDates.size;
    const halfDays = halfDayDates.size;
    const totalPresent = fullDays + (halfDays * 0.5) + unsubmittedWorkingDays;
    const absentDays = absentDates.size;
    // Use consistent rounding: Math.round for all percentage calculations
    const percentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

    const months = [];
    let monthIter = new Date(effectiveStart);
    
    while (monthIter <= end) {
      const monthStart = new Date(monthIter.getFullYear(), monthIter.getMonth(), 1);
      const monthEnd = new Date(monthIter.getFullYear(), monthIter.getMonth() + 1, 0);
      monthStart.setUTCHours(0, 0, 0, 0);
      monthEnd.setUTCHours(23, 59, 59, 999);

      const periodStart = monthStart < effectiveStart ? effectiveStart : monthStart;
      const periodEnd = monthEnd > end ? end : monthEnd;

      const monthRecords = recordsInRange.filter(a => {
        const attDate = new Date(a.date);
        attDate.setUTCHours(0, 0, 0, 0);
        return attDate >= periodStart && attDate <= periodEnd;
      });

      const monthDaysBetween = [];
      let monthCurrent = new Date(periodStart);
      while (monthCurrent <= periodEnd) {
        monthDaysBetween.push(monthCurrent.toISOString().split('T')[0]);
        monthCurrent.setDate(monthCurrent.getDate() + 1);
      }
      
      const monthWorkingDays = monthDaysBetween.filter(d => isWorkingDay(d, holidays, overrides)).length;
      const monthWorkingDaysSet = new Set(monthDaysBetween.filter(d => isWorkingDay(d, holidays, overrides)));

      const monthFullDayDates = new Set();
      const monthHalfDayDates = new Set();
      const monthAbsentDates = new Set();
      
      monthRecords.forEach(a => {
        if (!a.is_holiday && a.attendance_type !== 'holiday' && monthWorkingDaysSet.has(a.date)) {
          if (a.attendance_type === 'full_day') {
            monthFullDayDates.add(a.date);
          } else if (a.attendance_type === 'half_day') {
            monthHalfDayDates.add(a.date);
          } else if (a.attendance_type === 'absent') {
            monthAbsentDates.add(a.date);
          }
        }
      });

      // Count unsubmitted as PRESENT
      const monthSubmittedWorkingDays = new Set();
      monthRecords.forEach(a => {
        if (monthWorkingDaysSet.has(a.date)) monthSubmittedWorkingDays.add(a.date);
      });
      const monthUnsubmittedWorkingDays = Array.from(monthWorkingDaysSet).filter(d => !monthSubmittedWorkingDays.has(d)).length;

      const monthFullDays = monthFullDayDates.size;
      const monthHalfDays = monthHalfDayDates.size;
      const monthTotalPresent = monthFullDays + (monthHalfDays * 0.5) + monthUnsubmittedWorkingDays;
      const monthAbsent = monthAbsentDates.size;
      const monthPercentage = monthWorkingDays > 0 ? Math.round((monthTotalPresent / monthWorkingDays) * 100) : 0;

      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthName = monthNames[monthIter.getMonth()];
      let displayText = monthName;

      if (periodStart.getMonth() === periodEnd.getMonth()) {
        if (periodStart.getDate() !== 1 || periodEnd.getDate() !== new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0).getDate()) {
          displayText = `${monthName} (${periodStart.getDate()}–${periodEnd.getDate()})`;
        }
      }

      months.push({
        month: monthName,
        year: monthIter.getFullYear(),
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

      monthIter.setMonth(monthIter.getMonth() + 1);
    }

    return Response.json({
      working_days: workingDays,
      present_days: Math.round(totalPresent * 100) / 100,
      absent_days: absentDays,
      percentage: workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0,
      monthly_breakdown: months
    });
  } catch (error) {
    console.error('Attendance summary calculation error:', error);
    return Response.json({ total_days: 0, present_days: 0, absent_days: 0, percentage: 0 });
  }
});