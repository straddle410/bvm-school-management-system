import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
    const body = await req.json();
    const { academicYear, classNameFilter, sectionFilter, examTypeIdOrName, _staffToken } = body;

    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const headerToken = authHeader.replace('Bearer ', '').trim();
    if (!headerToken && !_staffToken) {
      return Response.json({ error: 'Unauthorized — no staff token provided' }, { status: 401 });
    }

    if (!academicYear || !classNameFilter || !sectionFilter || !examTypeIdOrName) {
      return Response.json({ error: 'Academic year, class, section, and exam type are required' }, { status: 400 });
    }

    const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear });
    if (yearConfigs.length === 0) {
      return Response.json({ error: `Academic year "${academicYear}" is not configured in the system.` }, { status: 400 });
    }
    const yearConfig = yearConfigs[0];

    const normalizeClassName = (name) => {
      if (!name) return name;
      const str = name.toString().trim();
      return /^[0-9]$/.test(str) || ['Nursery', 'LKG', 'UKG'].includes(str) ? str : str.replace(/^Class\s*/i, '');
    };

    const classSubjectConfigs = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: academicYear,
      class_name: normalizeClassName(classNameFilter)
    });
    const subjectSortMap = {};
    if (classSubjectConfigs.length > 0 && Array.isArray(classSubjectConfigs[0].subject_names)) {
      classSubjectConfigs[0].subject_names.forEach((name, idx) => {
        subjectSortMap[name] = idx;
      });
    }

    const allExamTypesForFilter = await base44.asServiceRole.entities.ExamType.filter({ academic_year: academicYear });
    const selectedExamTypeRecord = allExamTypesForFilter.find(et => et.id === examTypeIdOrName || et.name === examTypeIdOrName);
    if (!selectedExamTypeRecord) {
      return Response.json({ error: `Exam type "${examTypeIdOrName}" not found for academic year ${academicYear}.` }, { status: 400 });
    }
    const selectedExamTypeId = selectedExamTypeRecord.id;

    const marksFilter = {
      academic_year: academicYear,
      exam_type: selectedExamTypeId
    };
    if (classNameFilter) marksFilter.class_name = normalizeClassName(classNameFilter);
    if (sectionFilter) marksFilter.section = sectionFilter;

    const allMarks = await base44.asServiceRole.entities.Marks.filter(marksFilter);
    const publishedMarks = allMarks.filter(m => m.status === 'Published' || m.status === 'Approved');

    if (publishedMarks.length === 0) {
      return Response.json({ message: 'No approved or published marks found', cardsGenerated: 0 });
    }

    const studentExamData = {};
    const seenMarks = new Set();

    publishedMarks.forEach(mark => {
      const markId = `${mark.student_id}__${mark.exam_type}__${mark.subject}`;
      if (seenMarks.has(markId)) return;
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
        internal_marks: mark.internal_marks_obtained ?? null,
        external_marks: mark.external_marks_obtained ?? null,
        max_marks: mark.max_marks,
        grade: mark.grade,
        sort_order: subjectSortMap[mark.subject] || 0
      });
      studentExamData[key].total_marks += mark.marks_obtained;
      studentExamData[key].max_marks += mark.max_marks;
    });

    Object.values(studentExamData).forEach(examData => {
      examData.subjects.sort((a, b) => a.sort_order - b.sort_order);
    });

    const examTypeMap = {};
    allExamTypesForFilter.forEach(et => {
      examTypeMap[et.id] = et.name;
      examTypeMap[et.name] = et.name;
    });

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

    const examRanks = {};
    Object.values(studentExamData).forEach(examData => {
      const examKey = `${examData.exam_type}__${examData.class_name}__${examData.section}`;
      if (!examRanks[examKey]) examRanks[examKey] = [];
      examRanks[examKey].push({
        student_id: examData.student_id,
        total: examData.total_marks
      });
    });

    Object.keys(examRanks).forEach(key => {
      examRanks[key].sort((a, b) => b.total - a.total);
      examRanks[key] = examRanks[key].map((item, idx) => ({
        ...item,
        rank: idx + 1
      }));
    });

    const examTypeRecords = allExamTypesForFilter;

    let globalAttendanceStartDate = null;
    let globalAttendanceEndDate = null;
    let rangeExamType = null;

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

    // Fetch holidays and overrides once for all students
    const holidays = await base44.asServiceRole.entities.Holiday.filter({ academic_year: academicYear });

    const progressCards = [];
    const uniqueStudents = new Map();

    const filteredStudentList = Object.values(studentData);
    for (let si = 0; si < filteredStudentList.length; si++) {
      const student = filteredStudentList[si];
      const studentKey = `${student.student_id}__${student.class_name}__${student.section}__${academicYear}`;
      if (uniqueStudents.has(studentKey)) continue;
      uniqueStudents.set(studentKey, true);

      const studentAttendance = await base44.entities.Attendance.filter({
        student_id: student.student_id,
        class_name: student.class_name,
        section: student.section
      });

      // Fetch overrides for this specific class/section
      const overrides = await base44.asServiceRole.entities.HolidayOverride.filter({
        class_name: student.class_name,
        section: student.section,
        academic_year: academicYear
      });

      const isWorkingDay = (dateStr) => {
        const d = new Date(dateStr);
        const day = d.getUTCDay();
        if (day === 0 || day === 6) return false;
        const holiday = holidays.find(h => h.date === dateStr && h.status === 'Active');
        if (holiday) {
          const override = overrides.find(o => o.date === dateStr);
          return !!override;
        }
        return true;
      };

      const calcAttendanceForRange = (records, startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        start.setUTCHours(0, 0, 0, 0);
        end.setUTCHours(23, 59, 59, 999);

        // Build attendance map: date -> record
        const attendanceMap = {};
        records.forEach(a => {
          if (a.date >= startDate && a.date <= endDate && (a.status === 'Submitted' || a.status === 'Approved' || a.auto_submitted === true)) {
            attendanceMap[a.date] = a;
          }
        });

        // Calculate working dates from calendar
        const workingDates = [];
        let current = new Date(start);
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          if (isWorkingDay(dateStr)) {
            workingDates.push(dateStr);
          }
          current.setUTCDate(current.getUTCDate() + 1);
        }

        // Calculate present/absent (missing = present by default)
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

        // Month-wise breakdown
        const months = [];
        let current2 = new Date(start);
        while (current2 <= end) {
          const monthStart = new Date(current2.getFullYear(), current2.getMonth(), 1);
          const monthEnd = new Date(current2.getFullYear(), current2.getMonth() + 1, 0);
          monthStart.setUTCHours(0, 0, 0, 0);
          monthEnd.setUTCHours(23, 59, 59, 999);
          const periodStart = monthStart < start ? start : monthStart;
          const periodEnd = monthEnd > end ? end : monthEnd;

          // Get working dates for this month
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
          const monthName = monthNames[current2.getMonth()];
          let displayText = monthName;
          if (periodStart.getMonth() === periodEnd.getMonth()) {
            if (periodStart.getDate() !== 1 || periodEnd.getDate() !== new Date(periodEnd.getFullYear(), periodEnd.getMonth() + 1, 0).getDate()) {
              displayText = `${monthName} (${periodStart.getDate()}–${periodEnd.getDate()})`;
            }
          }

          months.push({
            month: monthName,
            year: current2.getFullYear(),
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

          current2.setMonth(current2.getMonth() + 1);
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

      let attendanceSummary = null;
      console.log(`[CALC-START] Student: ${student.student_name}, startDate: ${globalAttendanceStartDate}, endDate: ${globalAttendanceEndDate}, studentRecords: ${studentAttendance.length}`);
      if (globalAttendanceStartDate && globalAttendanceEndDate) {
        const rangeResult = calcAttendanceForRange(studentAttendance, globalAttendanceStartDate, globalAttendanceEndDate);
        if (rangeResult.working_days > 0) {
          attendanceSummary = {
            range_start: globalAttendanceStartDate,
            range_end: globalAttendanceEndDate,
            ...rangeResult
          };
          console.log(`[CALC-DONE] Summary: working_days=${attendanceSummary.working_days}, full=${attendanceSummary.full_days_present}, half=${attendanceSummary.half_days_present}, absent=${attendanceSummary.absent_days}, pct=${attendanceSummary.attendance_percentage}%`);
        } else {
          console.warn(`[SKIP-ATTENDANCE] Student ${student.student_name} (${student.student_id}) - no working days found in range`);
        }
      } else {
        console.warn(`[SKIP-ATTENDANCE] Missing attendance range for ${student.student_name}`);
      }

      Object.values(student.exams).filter(ed => ed.exam_type === selectedExamTypeId || ed.exam_type === examTypeIdOrName).forEach(examData => {
        const examKey = `${examData.exam_type}__${examData.class_name}__${examData.section}`;
        const rankData = examRanks[examKey]?.find(r => r.student_id === student.student_id);
        const percentage = examData.max_marks > 0 ? (examData.total_marks / examData.max_marks) * 100 : 0;
        const grade = calculateGrade(percentage);

        progressCards.push({
          student_id: student.student_id,
          student_name: student.student_name,
          class_name: student.class_name,
          section: student.section,
          roll_number: student.roll_number,
          academic_year: academicYear,
          exam_performance: [{
            exam_type: examData.exam_type,
            exam_type_id: selectedExamTypeId,
            exam_type_name: examTypeMap[examData.exam_type] || examData.exam_type,
            exam_name: examTypeMap[examData.exam_type] || examData.exam_type,
            total_marks: examData.total_marks,
            max_marks: examData.max_marks,
            percentage: Math.round(percentage * 100) / 100,
            rank: rankData?.rank || 0,
            grade: grade,
            subject_details: examData.subjects.map(({ subject, marks_obtained, internal_marks, external_marks, max_marks, grade, teacher_remarks }) => ({
              subject, marks_obtained, internal_marks, external_marks, max_marks, grade, teacher_remarks
            }))
          }],
          overall_stats: {
            total_marks_obtained: Math.round(examData.total_marks * 100) / 100,
            total_possible_marks: examData.max_marks,
            overall_percentage: Math.round(percentage * 100) / 100,
            overall_rank: rankData?.rank || 0,
            overall_grade: grade
          },
          attendance_summary: attendanceSummary && Object.keys(attendanceSummary).length > 0 ? attendanceSummary : null,
          generated_at: new Date().toISOString(),
          status: 'Generated'
        });
      });
    }

    const allExistingCards = await base44.asServiceRole.entities.ProgressCard.filter({
      academic_year: academicYear,
      class_name: normalizeClassName(classNameFilter),
      section: sectionFilter
    });

    const studentsWithCard = new Set();
    for (const card of allExistingCards) {
      const ep = card.exam_performance?.[0] || {};
      const isMatch =
        ep.exam_type_id === selectedExamTypeId ||
        ep.exam_type === selectedExamTypeId ||
        ep.exam_type_name === selectedExamTypeRecord?.name ||
        ep.exam_type === selectedExamTypeRecord?.name;
      if (isMatch) studentsWithCard.add(card.student_id);
    }

    console.log(`[DEDUP] Existing cards for this exam type: ${studentsWithCard.size}, exam type ID: ${selectedExamTypeId}, name: ${selectedExamTypeRecord?.name}`);

    const newCards = progressCards.filter(c => !studentsWithCard.has(c.student_id));
    const skippedCount = progressCards.length - newCards.length;

    console.log(`[SKIP-CHECK] Total candidates: ${progressCards.length}, Already exist: ${skippedCount}, To create: ${newCards.length}`);

    if (newCards.length > 0) {
      await base44.asServiceRole.entities.ProgressCard.bulkCreate(newCards);
    }

    return Response.json({
      message: `${newCards.length} cards generated, ${skippedCount} already existed, 0 duplicates created`,
      cardsGenerated: newCards.length,
      skippedCount: skippedCount,
      totalStudents: progressCards.length,
      examTypeName: selectedExamTypeRecord?.name || examTypeIdOrName
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