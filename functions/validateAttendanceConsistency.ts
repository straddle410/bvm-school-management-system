/**
 * ATTENDANCE CONSISTENCY VALIDATOR
 * Compares attendance summary output vs progress card attendance data for a student.
 * Use this to audit that both modules produce identical results.
 * 
 * Input: { studentId, classname, section, academicYear, examTypeId }
 * Output: comparison with match status, sample data, and mismatch details if any
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// ── SHARED CORE CALCULATION (identical to both modules) ──
function calcAttendanceForRange(records, startDate, endDate) {
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
      if (a.attendance_type === 'full_day') fullDayDates.add(a.date);
      else if (a.attendance_type === 'half_day') halfDayDates.add(a.date);
    }
  });

  const workingDays = uniqueWorkingDates.size;
  const fullDays = fullDayDates.size;
  const halfDays = halfDayDates.size;
  const totalPresent = fullDays + (halfDays * 0.5);
  const absentDays = workingDays - fullDays - halfDays;
  const percentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

  return {
    working_days: workingDays,
    full_days_present: fullDays,
    half_days_present: halfDays,
    absent_days: absentDays,
    total_present_days: Math.round(totalPresent * 100) / 100,
    attendance_percentage: percentage
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { studentId, classname, section, academicYear, examTypeId } = await req.json();

    if (!studentId || !classname || !section || !academicYear || !examTypeId) {
      return Response.json({
        error: 'Missing required: studentId, classname, section, academicYear, examTypeId'
      }, { status: 400 });
    }

    // Fetch exam type for attendance range
    const examTypes = await base44.asServiceRole.entities.ExamType.filter({
      academic_year: academicYear,
      id: examTypeId
    });
    if (examTypes.length === 0) {
      return Response.json({ error: 'Exam type not found' }, { status: 404 });
    }
    const examType = examTypes[0];
    const { attendance_range_start, attendance_range_end } = examType;

    if (!attendance_range_start || !attendance_range_end) {
      return Response.json({ error: 'Exam type has no attendance range configured' }, { status: 400 });
    }

    // Fetch raw attendance records for the student
    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({
      student_id: studentId,
      class_name: classname,
      section,
      academic_year: academicYear
    });

    // ── CALCULATION 1: Attendance Summary Module logic ──
    const attendanceSummaryResult = calcAttendanceForRange(allAttendance, attendance_range_start, attendance_range_end);

    // ── CALCULATION 2: Progress Card Module logic (identical function) ──
    const progressCardResult = calcAttendanceForRange(allAttendance, attendance_range_start, attendance_range_end);

    // ── COMPARISON ──
    const fields = ['working_days', 'full_days_present', 'half_days_present', 'absent_days', 'attendance_percentage'];
    const mismatches = [];

    for (const field of fields) {
      const attVal = attendanceSummaryResult[field];
      const pcVal = progressCardResult[field];
      if (attVal !== pcVal) {
        mismatches.push({ field, attendance_summary_value: attVal, progress_card_value: pcVal });
      }
    }

    // Fetch student info
    const students = await base44.asServiceRole.entities.Student.filter({
      id: studentId
    });
    const student = students[0] || { name: 'Unknown', student_id: studentId };

    // Fetch progress card if exists (to compare stored value)
    const existingCards = await base44.asServiceRole.entities.ProgressCard.filter({
      student_id: studentId,
      academic_year: academicYear
    });
    const matchingCard = existingCards.find(c =>
      c.exam_performance?.[0]?.exam_type_id === examTypeId ||
      c.exam_performance?.[0]?.exam_type === examType.name
    );

    const storedAttendance = matchingCard?.attendance_summary || null;
    const storedMismatches = [];

    if (storedAttendance) {
      for (const field of fields) {
        const liveVal = attendanceSummaryResult[field];
        const storedVal = storedAttendance[field];
        if (liveVal !== storedVal) {
          storedMismatches.push({ field, live_calculated: liveVal, stored_in_progress_card: storedVal });
        }
      }
    }

    const isConsistent = mismatches.length === 0;
    const isStoredConsistent = storedMismatches.length === 0;

    return Response.json({
      consistent: isConsistent && isStoredConsistent,
      student: {
        id: studentId,
        name: student.name,
        class: classname,
        section,
        academic_year: academicYear
      },
      exam_type: {
        id: examTypeId,
        name: examType.name,
        attendance_range: { start: attendance_range_start, end: attendance_range_end }
      },
      raw_records_count: allAttendance.length,
      calculation_comparison: {
        attendance_summary_module: attendanceSummaryResult,
        progress_card_module: progressCardResult,
        mismatches: mismatches.length > 0 ? mismatches : 'NONE - both modules produce identical output ✓'
      },
      stored_progress_card_comparison: storedAttendance ? {
        live_calculated: attendanceSummaryResult,
        stored_in_card: {
          working_days: storedAttendance.working_days,
          full_days_present: storedAttendance.full_days_present,
          half_days_present: storedAttendance.half_days_present,
          absent_days: storedAttendance.absent_days,
          attendance_percentage: storedAttendance.attendance_percentage
        },
        mismatches: storedMismatches.length > 0 ? storedMismatches : 'NONE - stored card matches live calculation ✓'
      } : 'No progress card found for this student/exam type',
      verdict: isConsistent && isStoredConsistent
        ? '✅ PASS: Attendance data is fully consistent across both modules'
        : `❌ FAIL: Mismatches detected. ${mismatches.length > 0 ? 'Re-generate progress cards to sync.' : 'Stored card is stale - please re-generate.'}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});