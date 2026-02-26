import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify user is authenticated
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { academicYear, examTypeId } = await req.json();

    if (!academicYear || !examTypeId) {
      return Response.json({ error: 'Academic year and exam type ID are required' }, { status: 400 });
    }

    // Fetch the exam type to get attendance range
    const examTypes = await base44.asServiceRole.entities.ExamType.filter({
      academic_year: academicYear,
      id: examTypeId
    });

    if (examTypes.length === 0) {
      return Response.json({ error: 'Exam type not found' }, { status: 404 });
    }

    const examType = examTypes[0];
    const attendanceRangeStart = examType.attendance_range_start;
    const attendanceRangeEnd = examType.attendance_range_end;

    if (!attendanceRangeStart || !attendanceRangeEnd) {
      return Response.json({
        error: `Exam type "${examType.name}" does not have an attendance date range configured. Please configure the attendance range in the exam type settings.`
      }, { status: 400 });
    }

    // Fetch published marks for this exam type only
    const allMarks = await base44.asServiceRole.entities.Marks.filter({
      academic_year: academicYear,
      exam_type: examTypeId
    });

    const publishedMarks = allMarks.filter(m => m.status === 'Published' || m.status === 'Approved');
    console.log(`[MARKS] Fetched ${publishedMarks.length} published marks for exam type "${examType.name}" (ID: ${examTypeId})`);

    if (publishedMarks.length === 0) {
      console.error(`[ERROR] No marks found with exam_type filter: ${examTypeId}`);
      console.error(`[DEBUG] Trying alternative filter with exam_type as string name...`);
      
      // Fallback: Try with exam type name if ID filter doesn't work
      const fallbackMarks = await base44.asServiceRole.entities.Marks.filter({
        academic_year: academicYear,
        exam_type: examType.name
      });
      const fallbackPublished = fallbackMarks.filter(m => m.status === 'Published' || m.status === 'Approved');
      console.log(`[DEBUG] Fallback: Found ${fallbackPublished.length} marks with name filter`);
      
      if (fallbackPublished.length === 0) {
        return Response.json({
          error: `No published or approved marks found for exam type "${examType.name}". Please publish marks first.`
        }, { status: 400 });
      }
      
      publishedMarks.push(...fallbackPublished);
    }

    // VALIDATION: Check if attendance records exist within the range
    console.log(`[ATTENDANCE] Fetching attendance records for academic year: ${academicYear}`);
    const attendanceInRange = await base44.asServiceRole.entities.Attendance.filter({
      academic_year: academicYear
    });
    console.log(`[ATTENDANCE] Total attendance records fetched: ${attendanceInRange.length}`);

    const recordsInRange = attendanceInRange.filter(a => {
      const attDate = new Date(a.date);
      attDate.setUTCHours(0, 0, 0, 0);
      const rangeStart = new Date(attendanceRangeStart);
      const rangeEnd = new Date(attendanceRangeEnd);
      rangeStart.setUTCHours(0, 0, 0, 0);
      rangeEnd.setUTCHours(23, 59, 59, 999);
      return attDate >= rangeStart && attDate <= rangeEnd;
    });

    console.log(`[ATTENDANCE] Records in range (${attendanceRangeStart} to ${attendanceRangeEnd}): ${recordsInRange.length}`);

    if (recordsInRange.length === 0) {
      return Response.json({
        error: `No attendance records found within the selected date range (${attendanceRangeStart} to ${attendanceRangeEnd}) for exam type "${examType.name}". Please verify attendance data exists in this range.`,
        rangeExamType: examType.name,
        requestedRange: { start: attendanceRangeStart, end: attendanceRangeEnd }
      }, { status: 400 });
    }

    // Fetch subjects for sorting
    const allSubjects = await base44.asServiceRole.entities.Subject.list();
    const subjectSortMap = {};
    allSubjects.forEach(s => {
      subjectSortMap[s.name] = s.sort_order || 0;
    });

    // Group marks by student
    const studentMarksMap = {};
    const seenMarks = new Set();

    publishedMarks.forEach(mark => {
      const markId = `${mark.student_id}__${mark.subject}`;
      if (seenMarks.has(markId)) return;
      seenMarks.add(markId);

      if (!studentMarksMap[mark.student_id]) {
        studentMarksMap[mark.student_id] = {
          student_id: mark.student_id,
          student_name: mark.student_name,
          class_name: mark.class_name,
          section: mark.section,
          subjects: [],
          total_marks: 0,
          max_marks: 0
        };
      }

      studentMarksMap[mark.student_id].subjects.push({
        subject: mark.subject,
        marks_obtained: mark.marks_obtained,
        max_marks: mark.max_marks,
        grade: mark.grade,
        teacher_remarks: mark.remarks || '',
        sort_order: subjectSortMap[mark.subject] || 0
      });

      studentMarksMap[mark.student_id].total_marks += mark.marks_obtained;
      studentMarksMap[mark.student_id].max_marks += mark.max_marks;
    });

    // Sort subjects by sort_order
    Object.values(studentMarksMap).forEach(data => {
      data.subjects.sort((a, b) => a.sort_order - b.sort_order);
    });

    // Calculate ranks by class/section
    const rankMap = {};
    Object.values(studentMarksMap).forEach(data => {
      const key = `${data.class_name}__${data.section}`;
      if (!rankMap[key]) rankMap[key] = [];
      rankMap[key].push({
        student_id: data.student_id,
        total: data.total_marks
      });
    });

    Object.keys(rankMap).forEach(key => {
      rankMap[key].sort((a, b) => b.total - a.total);
      rankMap[key] = rankMap[key].map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
    });

    // Helper: Calculate attendance for a date range
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

      // Get unique working days (excluding holidays)
      const uniqueWorkingDates = new Set();
      allInRange.forEach(a => {
        if (!a.is_holiday && a.attendance_type !== 'holiday') {
          uniqueWorkingDates.add(a.date);
        }
      });
      const workingDays = uniqueWorkingDates.size;

      // Count present days
      const presentRecords = allInRange.filter(a => 
        !a.is_holiday && a.attendance_type !== 'holiday' && a.attendance_type !== 'absent'
      );

      const fullDays = presentRecords.filter(a => a.attendance_type === 'full_day').length;
      const halfDays = presentRecords.filter(a => a.attendance_type === 'half_day').length;
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

    // Helper: Get month-wise breakdown
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

    // Generate progress cards
    const progressCards = [];
    const uniqueStudents = new Map();

    Object.values(studentMarksMap).forEach(studentMarks => {
      const studentKey = `${studentMarks.student_id}__${studentMarks.class_name}__${studentMarks.section}__${academicYear}`;
      if (uniqueStudents.has(studentKey)) return;
      uniqueStudents.set(studentKey, true);

      const percentage = studentMarks.max_marks > 0 
        ? (studentMarks.total_marks / studentMarks.max_marks) * 100 
        : 0;
      const grade = calculateGrade(percentage);

      const rankKey = `${studentMarks.class_name}__${studentMarks.section}`;
      const rankData = rankMap[rankKey]?.find(r => r.student_id === studentMarks.student_id);

      // Fetch attendance for this student
      const studentAttendance = attendanceInRange.filter(a =>
        a.student_id === studentMarks.student_id &&
        a.class_name === studentMarks.class_name &&
        a.section === studentMarks.section
      );

      // VALIDATION: Ensure student has attendance records in range
      const studentRecordsInRange = studentAttendance.filter(a => {
        const attDate = new Date(a.date);
        attDate.setUTCHours(0, 0, 0, 0);
        const rangeStart = new Date(attendanceRangeStart);
        const rangeEnd = new Date(attendanceRangeEnd);
        rangeStart.setUTCHours(0, 0, 0, 0);
        rangeEnd.setUTCHours(23, 59, 59, 999);
        return attDate >= rangeStart && attDate <= rangeEnd;
      });

      if (studentRecordsInRange.length === 0) {
        throw new Error(`Student ${studentMarks.student_name} (${studentMarks.student_id}) has no attendance records in range ${attendanceRangeStart} to ${attendanceRangeEnd}.`);
      }

      console.log(`[DEBUG-ATTENDANCE-FETCH] Student ${studentMarks.student_name} (${studentMarks.student_id}): Found ${studentAttendance.length} total attendance records`);
      console.log(`[DEBUG-ATTENDANCE-IN-RANGE] Same student: ${studentRecordsInRange.length} records in range ${attendanceRangeStart} to ${attendanceRangeEnd}`);

      const rangeAttendance = calculateAttendanceForRange(studentAttendance, attendanceRangeStart, attendanceRangeEnd);
      console.log(`[DEBUG-RANGE-CALC] Student ${studentMarks.student_name}: Range result = ${JSON.stringify(rangeAttendance)}`);

      const monthWiseBreakdown = getMonthWiseBreakdown(studentAttendance, attendanceRangeStart, attendanceRangeEnd);
      console.log(`[DEBUG-MONTH-BREAKDOWN] Student ${studentMarks.student_name}: Monthly breakdown = ${JSON.stringify(monthWiseBreakdown)}`);

      const attendanceSummary = {
        range_start: attendanceRangeStart,
        range_end: attendanceRangeEnd,
        ...rangeAttendance,
        month_wise_breakdown: monthWiseBreakdown
      };

      // FAIL-FAST: Validate attendance_summary is fully populated
      if (!attendanceSummary.range_start || !attendanceSummary.range_end || attendanceSummary.working_days === undefined) {
        throw new Error(`[ATTENDANCE-VALIDATION-FAILED] Incomplete attendance_summary for student ${studentMarks.student_name}: ${JSON.stringify(attendanceSummary)}`);
      }

      console.log(`[ATTENDANCE-SUMMARY] Student ${studentMarks.student_name} (${studentMarks.student_id}): working_days=${attendanceSummary.working_days}, percentage=${attendanceSummary.attendance_percentage}, months=${monthWiseBreakdown.length}`);

      progressCards.push({
        student_id: studentMarks.student_id,
        student_name: studentMarks.student_name,
        class_name: studentMarks.class_name,
        section: studentMarks.section,
        roll_number: null,
        academic_year: academicYear,
        exam_performance: [{
          exam_type: examType.name,
          exam_type_id: examType.id,
          exam_type_name: examType.name,
          exam_category: examType.category,
          total_marks_obtained: studentMarks.total_marks,
          total_max_marks: studentMarks.max_marks,
          percentage: Math.round(percentage * 100) / 100,
          grade: grade,
          rank_in_class: rankData?.rank || 0,
          subject_details: studentMarks.subjects.map(s => ({
            subject: s.subject,
            marks_obtained: s.marks_obtained,
            max_marks: s.max_marks,
            percentage: s.max_marks > 0 ? Math.round((s.marks_obtained / s.max_marks) * 100) : 0,
            grade: s.grade,
            teacher_remarks: s.teacher_remarks
          }))
        }],
        overall_stats: {
          total_marks_obtained: studentMarks.total_marks,
          total_possible_marks: studentMarks.max_marks,
          overall_percentage: Math.round(percentage * 100) / 100,
          overall_grade: grade,
          overall_rank: rankData?.rank || 0,
          class_strength: rankMap[rankKey]?.length || 0
        },
        attendance_summary: attendanceSummary,
        generated_at: new Date().toISOString(),
        status: 'Generated'
      });
    });

    // Delete existing progress cards for this exam type
    const existingCards = await base44.asServiceRole.entities.ProgressCard.filter({
      academic_year: academicYear
    });

    for (const card of existingCards) {
      if (card.exam_performance?.[0]?.exam_type_id === examType.id || 
          card.exam_performance?.[0]?.exam_type === examType.name) {
        await base44.asServiceRole.entities.ProgressCard.delete(card.id);
      }
    }

    // Bulk create progress cards
    if (progressCards.length > 0) {
      console.log(`[PROGRESS-CARDS] Creating ${progressCards.length} progress cards...`);
      progressCards.forEach(card => {
        console.log(`[PROGRESS-CARD-DATA] Student: ${card.student_name}, Attendance Summary Exists: ${!!card.attendance_summary}, Range: ${card.attendance_summary?.range_start} to ${card.attendance_summary?.range_end}`);
      });
      await base44.asServiceRole.entities.ProgressCard.bulkCreate(progressCards);
      console.log(`[PROGRESS-CARDS] Successfully created ${progressCards.length} progress cards`);
    }

    return Response.json({
      message: `Generated progress cards for ${progressCards.length} students for exam "${examType.name}"`,
      cardsGenerated: progressCards.length,
      examType: examType.name,
      attendanceRange: { start: attendanceRangeStart, end: attendanceRangeEnd }
    });
  } catch (error) {
    console.error('Progress card generation error:', error);
    return Response.json(
      { error: error.message || 'Failed to generate progress cards' },
      { status: 500 }
    );
  }
});

function calculateGrade(percentage) {
  if (percentage >= 90) return 'A+';
  if (percentage >= 80) return 'A';
  if (percentage >= 70) return 'B+';
  if (percentage >= 60) return 'B';
  if (percentage >= 50) return 'C';
  if (percentage >= 40) return 'D';
  return 'F';
}