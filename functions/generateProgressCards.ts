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
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { academicYear, classNameFilter, sectionFilter } = await req.json();

    if (!academicYear) {
      return Response.json({ error: 'Academic year is required' }, { status: 400 });
    }

    // ── ACADEMIC YEAR BOUNDARY CHECK ──
    const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear });
    if (yearConfigs.length === 0) {
      return Response.json({ error: `Academic year "${academicYear}" is not configured in the system.` }, { status: 400 });
    }
    const yearConfig = yearConfigs[0];

    // Standardize class name format (handle both "9" and "Class 9")
    const normalizeClassName = (name) => {
      if (!name) return name;
      const str = name.toString().trim();
      return /^[0-9]$/.test(str) || ['Nursery', 'LKG', 'UKG'].includes(str) ? str : str.replace(/^Class\s*/i, '');
    };

    // Fetch subjects for sorting
     const allSubjects = await base44.asServiceRole.entities.Subject.list();
     const subjectSortMap = {};
     allSubjects.forEach(s => {
       subjectSortMap[s.name] = s.sort_order || 0;
     });

     // Fetch published or approved marks with filters
     const marksFilter = {
       academic_year: academicYear
     };
     if (classNameFilter) marksFilter.class_name = normalizeClassName(classNameFilter);
     if (sectionFilter) marksFilter.section = sectionFilter;

     const allMarks = await base44.asServiceRole.entities.Marks.filter(marksFilter);
     const publishedMarks = allMarks.filter(m => m.status === 'Published' || m.status === 'Approved');

     if (publishedMarks.length === 0) {
       return Response.json({ message: 'No approved or published marks found', cardsGenerated: 0 });
     }

     // Group by student and exam type, deduplicate marks
     const studentExamData = {};
     const seenMarks = new Set(); // Track seen marks to prevent duplicates

     publishedMarks.forEach(mark => {
       // Create a unique identifier for this mark entry
       const markId = `${mark.student_id}__${mark.exam_type}__${mark.subject}`;
       if (seenMarks.has(markId)) return; // Skip duplicate marks
       seenMarks.add(markId);

       const key = `${mark.student_id}__${mark.exam_type}`;
       if (!studentExamData[key]) {
         studentExamData[key] = {
           student_id: mark.student_id,
           student_name: mark.student_name,
           class_name: normalizeClassName(mark.class_name),
           section: mark.section,
           roll_number: mark.roll_number,
           exam_type: mark.exam_type,
           exam_name: mark.exam_type,
           subjects: [],
           total_marks: 0,
           max_marks: 0
         };
       }
       studentExamData[key].subjects.push({
         subject: mark.subject,
         marks_obtained: mark.marks_obtained,
         max_marks: mark.max_marks,
         grade: mark.grade,
         sort_order: subjectSortMap[mark.subject] || 0
       });
       studentExamData[key].total_marks += mark.marks_obtained;
       studentExamData[key].max_marks += mark.max_marks;
     });

     // Sort subjects by sort_order in all exam data
     Object.values(studentExamData).forEach(examData => {
       examData.subjects.sort((a, b) => a.sort_order - b.sort_order);
     });

    // Get exam type names to display
    const examTypes = await base44.asServiceRole.entities.ExamType.list();
    const examTypeMap = {};
    examTypes.forEach(et => {
      examTypeMap[et.id] = et.name;
      examTypeMap[et.name] = et.name;
    });

    // Group by student to calculate ranks per exam
    const studentData = {};
    Object.values(studentExamData).forEach(examData => {
      if (!studentData[examData.student_id]) {
        studentData[examData.student_id] = {
          student_id: examData.student_id,
          student_name: examData.student_name,
          class_name: examData.class_name,
          section: examData.section,
          roll_number: examData.roll_number,
          exams: {}
        };
      }
      studentData[examData.student_id].exams[examData.exam_type] = examData;
    });

    // Calculate ranks for each exam type
    const examRanks = {};
    Object.values(studentExamData).forEach(examData => {
      const examKey = `${examData.exam_type}__${examData.class_name}__${examData.section}`;
      if (!examRanks[examKey]) examRanks[examKey] = [];
      examRanks[examKey].push({
        student_id: examData.student_id,
        total: examData.total_marks
      });
    });

    // Sort and assign ranks
    Object.keys(examRanks).forEach(key => {
      examRanks[key].sort((a, b) => b.total - a.total);
      examRanks[key] = examRanks[key].map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
    });

    // Fetch exam type details ONCE for all students (for attendance range)
    const examTypeRecords = await base44.asServiceRole.entities.ExamType.filter({
      academic_year: academicYear
    });

    // Determine attendance range once - use the exam with the latest END date (most comprehensive range)
    let globalAttendanceStartDate = null;
    let globalAttendanceEndDate = null;
    let rangeExamType = null;

    // Validate attendance ranges are within academic year
    for (const et of examTypeRecords.filter(e => e.attendance_range_start || e.attendance_range_end)) {
      if (et.attendance_range_start && !validateAcademicYearBoundary(et.attendance_range_start, yearConfig.start_date, yearConfig.end_date)) {
        return Response.json({
          error: `Action not allowed outside selected Academic Year. Attendance range start for exam "${et.name}" is outside the ${academicYear} range (${yearConfig.start_date} to ${yearConfig.end_date}).`
        }, { status: 400 });
      }
      if (et.attendance_range_end && !validateAcademicYearBoundary(et.attendance_range_end, yearConfig.start_date, yearConfig.end_date)) {
        return Response.json({
          error: `Action not allowed outside selected Academic Year. Attendance range end for exam "${et.name}" is outside the ${academicYear} range (${yearConfig.start_date} to ${yearConfig.end_date}).`
        }, { status: 400 });
      }
    }

    const examTypesWithRange = examTypeRecords.filter(e => e.attendance_range_start && e.attendance_range_end);
    if (examTypesWithRange.length > 0) {
      // Sort by end_date descending to get the exam with the latest end date (most comprehensive)
      const sorted = examTypesWithRange.sort((a, b) => new Date(b.attendance_range_end) - new Date(a.attendance_range_end));
      globalAttendanceStartDate = sorted[0].attendance_range_start;
      globalAttendanceEndDate = sorted[0].attendance_range_end;
      rangeExamType = sorted[0].name;
      console.log(`[RANGE FOUND] Exam: ${rangeExamType}, Range: ${globalAttendanceStartDate} to ${globalAttendanceEndDate}`);
    } else {
      return Response.json(
        { error: `No exam types with attendance date ranges found for academic year ${academicYear}. Please configure attendance_range_start and attendance_range_end in at least one ExamType.` },
        { status: 400 }
      );
    }

    // VALIDATION: Check if attendance records exist within the selected range
    const attendanceInRange = await base44.asServiceRole.entities.Attendance.filter({
      academic_year: academicYear
    });

    const recordsInRange = attendanceInRange.filter(a => {
      const attDate = new Date(a.date);
      attDate.setUTCHours(0, 0, 0, 0);
      const rangeStart = new Date(globalAttendanceStartDate);
      const rangeEnd = new Date(globalAttendanceEndDate);
      rangeStart.setUTCHours(0, 0, 0, 0);
      rangeEnd.setUTCHours(23, 59, 59, 999);
      return attDate >= rangeStart && attDate <= rangeEnd;
    });

    if (recordsInRange.length === 0) {
      return Response.json(
        { 
          error: `No attendance records found within the selected date range (${globalAttendanceStartDate} to ${globalAttendanceEndDate}) from ExamType "${rangeExamType}". Please update the attendance date range in ExamType or verify attendance records exist.`,
          rangeExamType,
          requestedRange: { start: globalAttendanceStartDate, end: globalAttendanceEndDate }
        },
        { status: 400 }
      );
    }

    // ── SOFT-DELETE GUARD: fetch all student ids for this year and exclude deleted ──
    const allStudentsInYear = await base44.asServiceRole.entities.Student.filter({ academic_year: academicYear });
    const deletedStudentIds = new Set(allStudentsInYear.filter(s => s.is_deleted).map(s => s.student_id).filter(Boolean));

    // Calculate overall statistics and generate progress cards
    const progressCards = [];
    const uniqueStudents = new Map();

    // Deduplicate students at the progress card level
    Object.values(studentData).filter(student => !deletedStudentIds.has(student.student_id)).forEach(student => {
      const studentKey = `${student.student_id}__${student.class_name}__${student.section}__${academicYear}`;
      if (uniqueStudents.has(studentKey)) return; // Skip duplicate student entries
      uniqueStudents.set(studentKey, true);

      const examPerformance = [];
      let totalMarksObtained = 0;
      let totalPossibleMarks = 0;

      Object.values(student.exams).forEach(examData => {
        const examKey = `${examData.exam_type}__${examData.class_name}__${examData.section}`;
        const rankData = examRanks[examKey]?.find(r => r.student_id === student.student_id);
        const percentage = examData.max_marks > 0 ? (examData.total_marks / examData.max_marks) * 100 : 0;
        const grade = calculateGrade(percentage);

        examPerformance.push({
          exam_type: examData.exam_type,
          exam_name: examTypeMap[examData.exam_type] || examData.exam_type,
          total_marks: examData.total_marks,
          max_marks: examData.max_marks,
          percentage: Math.round(percentage * 100) / 100,
          rank: rankData?.rank || 0,
          grade: grade,
          subject_details: examData.subjects.map(({ subject, marks_obtained, max_marks, grade, teacher_remarks }) => ({
            subject, marks_obtained, max_marks, grade, teacher_remarks
          }))
        });

        totalMarksObtained += examData.total_marks;
        totalPossibleMarks += examData.max_marks;
      });

      const overallPercentage = totalPossibleMarks > 0 ? (totalMarksObtained / totalPossibleMarks) * 100 : 0;
      const overallGrade = calculateGrade(overallPercentage);

      // Use global attendance range - fall back to student's actual attendance range if needed
      let attendanceStartDate = globalAttendanceStartDate;
      let attendanceEndDate = globalAttendanceEndDate;

      // Fetch attendance records for this student
      const studentAttendance = await base44.asServiceRole.entities.Attendance.filter({
        student_id: student.student_id,
        class_name: student.class_name,
        section: student.section
      });

      // If no exam type range found, determine from student's actual attendance
      if (!attendanceStartDate || !attendanceEndDate) {
        if (studentAttendance.length > 0) {
          const dates = studentAttendance
            .map(a => new Date(a.date))
            .sort((a, b) => a - b);
          attendanceStartDate = dates[0].toISOString().split('T')[0];
          attendanceEndDate = dates[dates.length - 1].toISOString().split('T')[0];
        }
      }

      // ── SHARED ATTENDANCE CALCULATION (Set-based deduplication - identical to attendance summary module) ──
      const calcAttendanceForRange = (records, startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);

        const allInRange = records.filter(a => {
          const attDate = new Date(a.date);
          attDate.setUTCHours(0, 0, 0, 0);
          return attDate >= start && attDate <= end;
        });

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

          const monthRecords = allInRange.filter(a => {
            const attDate = new Date(a.date);
            attDate.setUTCHours(0, 0, 0, 0);
            return attDate >= periodStart && attDate <= periodEnd;
          });

          const mWorkingDates = new Set();
          const mFullDates = new Set();
          const mHalfDates = new Set();
          monthRecords.forEach(a => {
            if (!a.is_holiday && a.attendance_type !== 'holiday') {
              mWorkingDates.add(a.date);
              if (a.attendance_type === 'full_day') mFullDates.add(a.date);
              else if (a.attendance_type === 'half_day') mHalfDates.add(a.date);
            }
          });

          const mWorking = mWorkingDates.size;
          const mFull = mFullDates.size;
          const mHalf = mHalfDates.size;
          const mPresent = mFull + (mHalf * 0.5);
          const mAbsent = mWorking - mFull - mHalf;
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
            total_present: Math.round(mPresent * 100) / 100,
            attendance_percentage: mPct
          });
          current.setMonth(current.getMonth() + 1);
        }

        return {
          working_days: workingDays,
          full_days_present: fullDays,
          half_days_present: halfDays,
          absent_days: absentDays,
          total_present_days: Math.round(totalPresent * 100) / 100,
          attendance_percentage: percentage,
          month_wise_breakdown: months
        };
      };

      // Calculate attendance summary
       let attendanceSummary = null;
       console.log(`[CALC-START] Student: ${student.student_name}, startDate: ${attendanceStartDate}, endDate: ${attendanceEndDate}, records: ${studentAttendance.length}`);
       if (attendanceStartDate && attendanceEndDate && studentAttendance.length > 0) {
         const studentRecordsInRange = studentAttendance.filter(a => {
           const attDate = new Date(a.date);
           attDate.setUTCHours(0, 0, 0, 0);
           const rangeStart = new Date(attendanceStartDate);
           const rangeEnd = new Date(attendanceEndDate);
           rangeStart.setUTCHours(0, 0, 0, 0);
           rangeEnd.setUTCHours(23, 59, 59, 999);
           return attDate >= rangeStart && attDate <= rangeEnd;
         });

         if (studentRecordsInRange.length === 0) {
           throw new Error(`Student ${student.student_name} (${student.student_id}) has no attendance records in range ${attendanceStartDate} to ${attendanceEndDate}. Cannot generate progress card without attendance data.`);
         }

         const rangeResult = calcAttendanceForRange(studentAttendance, attendanceStartDate, attendanceEndDate);
         attendanceSummary = {
           range_start: attendanceStartDate,
           range_end: attendanceEndDate,
           ...rangeResult
         };
         console.log(`[CALC-DONE] Summary: working_days=${attendanceSummary.working_days}, full=${attendanceSummary.full_days_present}, half=${attendanceSummary.half_days_present}, absent=${attendanceSummary.absent_days}, pct=${attendanceSummary.attendance_percentage}%`);
       } else {
         throw new Error(`Cannot generate progress card for ${student.student_name}: Missing attendance date range or no attendance records found.`);
       }

      // Calculate overall rank (per class/section)
      const classStudents = Object.values(studentData).filter(s => 
        s.class_name === student.class_name && s.section === student.section
      );
      const classRankings = classStudents.map(s => {
        let total = 0;
        Object.values(s.exams).forEach(e => (total += e.total_marks));
        return { student_id: s.student_id, total };
      }).sort((a, b) => b.total - a.total);

      const overallRank = classRankings.findIndex(s => s.student_id === student.student_id) + 1;

      progressCards.push({
        student_id: student.student_id,
        student_name: student.student_name,
        class_name: student.class_name,
        section: student.section,
        roll_number: student.roll_number,
        academic_year: academicYear,
        exam_performance: examPerformance,
        overall_stats: {
          total_marks_obtained: Math.round(totalMarksObtained * 100) / 100,
          total_possible_marks: totalPossibleMarks,
          overall_percentage: Math.round(overallPercentage * 100) / 100,
          overall_rank: overallRank,
          overall_grade: overallGrade
        },
        attendance_summary: attendanceSummary && Object.keys(attendanceSummary).length > 0 ? attendanceSummary : null,
        generated_at: new Date().toISOString(),
        status: 'Generated'
      });
    });

    // Clear existing cards for this class/section/year to prevent duplicates
    const existingCards = await base44.asServiceRole.entities.ProgressCard.filter({
      academic_year: academicYear
    });

    for (const card of existingCards) {
      const cardClassMatch = !classNameFilter || normalizeClassName(card.class_name) === normalizeClassName(classNameFilter);
      const cardSectionMatch = !sectionFilter || card.section === sectionFilter;

      if (cardClassMatch && cardSectionMatch) {
        await base44.asServiceRole.entities.ProgressCard.delete(card.id);
      }
    }

    // Bulk create progress cards
    if (progressCards.length > 0) {
      await base44.asServiceRole.entities.ProgressCard.bulkCreate(progressCards);
    }

    return Response.json({
      message: `Generated progress cards for ${progressCards.length} students`,
      cardsGenerated: progressCards.length
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