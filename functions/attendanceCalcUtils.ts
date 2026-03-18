/**
 * SHARED ATTENDANCE CALCULATION UTILITY
 * Single source of truth for all attendance calculations.
 * Used by: generateProgressCardsForExamType, calculateAttendanceSummaryForStudent, validateAttendanceConsistency
 * 
 * RULES:
 * - Unique date deduplication (Set-based) to handle duplicate records
 * - Holiday exclusion: is_holiday=true OR attendance_type='holiday'
 * - Half-day counts as 0.5
 * - Same month-wise grouping logic across all modules
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Core attendance calculation - processes raw attendance records for a date range.
 * Returns: { working_days, full_days_present, half_days_present, total_present_days, attendance_percentage, month_wise_breakdown }
 */
export function calcAttendanceForRange(records, startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setUTCHours(0, 0, 0, 0);
  end.setUTCHours(23, 59, 59, 999);

  const recordsInRange = records.filter(a => {
    const attDate = new Date(a.date);
    attDate.setUTCHours(0, 0, 0, 0);
    return attDate >= start && attDate <= end;
  });

  const uniqueWorkingDates = new Set();
  const fullDayDates = new Set();
  const halfDayDates = new Set();

  recordsInRange.forEach(a => {
    if (!a.is_holiday && a.attendance_type !== 'holiday') {
      uniqueWorkingDates.add(a.date);
      if (a.attendance_type === 'full_day') {
        fullDayDates.add(a.date);
      } else if (a.attendance_type === 'half_day') {
        halfDayDates.add(a.date);
      }
    }
  });

  const workingDays = uniqueWorkingDates.size;
  const fullDays = fullDayDates.size;
  const halfDays = halfDayDates.size;
  const totalPresent = fullDays + (halfDays * 0.5);
  const absentDays = workingDays - fullDays - halfDays;
  const percentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

  const monthWise = calcMonthWiseBreakdown(recordsInRange, start, end);

  return {
    range_start: startDate,
    range_end: endDate,
    working_days: workingDays,
    full_days_present: fullDays,
    half_days_present: halfDays,
    absent_days: absentDays,
    total_present_days: Math.round(totalPresent * 100) / 100,
    attendance_percentage: percentage,
    month_wise_breakdown: monthWise
  };
}

/**
 * Month-wise breakdown - identical logic used across all modules.
 */
function calcMonthWiseBreakdown(recordsInRange, start, end) {
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
    const monthFullDayDates = new Set();
    const monthHalfDayDates = new Set();

    monthRecords.forEach(a => {
      if (!a.is_holiday && a.attendance_type !== 'holiday') {
        uniqueMonthWorkingDates.add(a.date);
        if (a.attendance_type === 'full_day') {
          monthFullDayDates.add(a.date);
        } else if (a.attendance_type === 'half_day') {
          monthHalfDayDates.add(a.date);
        }
      }
    });

    const monthWorkingDays = uniqueMonthWorkingDates.size;
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

  return months;
}

// This file is a utility module - it also exposes an HTTP endpoint for direct invocation
Deno.serve(async (req) => {
  return Response.json({ message: 'Attendance calc utils - import calcAttendanceForRange directly' });
});