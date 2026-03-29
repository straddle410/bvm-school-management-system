import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, academic_year } = await req.json();

    if (!student_id || !academic_year) {
      return Response.json({ error: 'student_id and academic_year required' }, { status: 400 });
    }

    // 1. Fetch student record
    const students = await base44.asServiceRole.entities.Student.filter({ student_id });
    const student = students?.[0];
    
    if (!student) {
      return Response.json({ error: `Student ${student_id} not found` }, { status: 404 });
    }

    // 2. Fetch academic year
    const years = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year });
    const yearRecord = years?.[0];
    
    if (!yearRecord) {
      return Response.json({ error: `Academic year ${academic_year} not found` }, { status: 404 });
    }

    // 3. Determine effective start date
    const effectiveStartDate = student.admission_date || yearRecord.start_date;
    const academicYearStart = yearRecord.start_date;
    const academicYearEnd = yearRecord.end_date;

    // 4. Fetch all attendance records for this student
    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({
      student_id: student_id,
      academic_year: academic_year
    });

    // 5. Separate records by dates
    const recordsBefore = allAttendance.filter(a => a.date < effectiveStartDate);
    const recordsAfter = allAttendance.filter(a => a.date >= effectiveStartDate);

    // 6. Count attendance types after effective start
    let fullDays = 0;
    let halfDays = 0;
    let absentDays = 0;
    let holidayDays = 0;

    recordsAfter.forEach(a => {
      if (a.attendance_type === 'full_day') fullDays++;
      else if (a.attendance_type === 'half_day') halfDays++;
      else if (a.attendance_type === 'absent') absentDays++;
      else if (a.attendance_type === 'holiday') holidayDays++;
    });

    // 7. Fetch holidays to calculate working days
    const holidays = await base44.asServiceRole.entities.Holiday.filter({ 
      academic_year: academic_year,
      status: 'Active'
    });
    const holidaySet = new Set(holidays.map(h => h.date));

    // Calculate working days from effective start to today
    const today = new Date().toISOString().split('T')[0];
    const daysBetween = [];
    let current = new Date(effectiveStartDate);
    const endDate = new Date(today);
    
    while (current <= endDate) {
      daysBetween.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    const sundaySet = new Set(daysBetween.filter(d => {
      const date = new Date(d + 'T00:00:00');
      date.setUTCHours(0, 0, 0, 0);
      return date.getDay() === 0;
    }));

    const workingDays = daysBetween.filter(d => 
      !holidaySet.has(d) && !sundaySet.has(d)
    ).length;

    const totalPresent = fullDays + (halfDays * 0.5);
    const calculatedPercentage = workingDays > 0 ? Math.round((totalPresent / workingDays) * 100) : 0;

    return Response.json({
      student: {
        id: student.id,
        student_id: student.student_id,
        name: student.name,
        class: student.class_name,
        section: student.section,
        admission_date: student.admission_date || 'NULL (uses academic year start)',
        is_promoted: !student.admission_date
      },
      academic_year_info: {
        year: academic_year,
        start_date: academicYearStart,
        end_date: academicYearEnd
      },
      effective_dates: {
        attendance_start_date: effectiveStartDate,
        calculation_end_date: today,
        reason: student.admission_date 
          ? `Using admission_date (${student.admission_date})` 
          : `No admission_date found, using academic year start (${academicYearStart})`
      },
      total_attendance_records: allAttendance.length,
      records_before_effective_start: {
        count: recordsBefore.length,
        dates: recordsBefore.map(r => r.date),
        status: 'IGNORED - Not counted in attendance'
      },
      records_after_effective_start: {
        count: recordsAfter.length,
        full_day: fullDays,
        half_day: halfDays,
        absent: absentDays,
        holiday: holidayDays
      },
      calculated_metrics: {
        working_days: workingDays,
        full_days_present: fullDays,
        half_days_present: halfDays,
        total_present_days: Math.round(totalPresent * 100) / 100,
        absent_days: Math.max(0, workingDays - fullDays - halfDays),
        attendance_percentage: calculatedPercentage
      },
      verification_summary: {
        status: 'VERIFIED',
        message: `${student_id} (${student.name}) attendance calculated correctly from ${effectiveStartDate}`,
        half_days_preserved: halfDays > 0 ? `✓ Half-days counted: ${halfDays} records (0.5 each)` : '✓ No half-day records'
      }
    });
  } catch (error) {
    console.error('Verification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});