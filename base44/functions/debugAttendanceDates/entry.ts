import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_name, start_date, end_date, academic_year } = await req.json();

    if (!student_name || !academic_year) {
      return Response.json({ error: 'student_name and academic_year are required' }, { status: 400 });
    }

    // Find student by name (flexible matching)
    const allStudents = await base44.asServiceRole.entities.Student.filter({ 
      academic_year: academic_year
    });

    const matchedStudents = allStudents.filter(s => 
      s.name.toLowerCase().includes(student_name.toLowerCase())
    );

    if (matchedStudents.length === 0) {
      return Response.json({ 
        error: `Student "${student_name}" not found. Available students: ${allStudents.map(s => s.name).slice(0, 10).join(', ')}...` 
      }, { status: 404 });
    }

    const students = matchedStudents;

    const student = students[0];
    console.log(`Found student: ${student.name} (${student.student_id}), Class: ${student.class_name}, Section: ${student.section}`);

    // Fetch all attendance for this student
    const attendance = await base44.asServiceRole.entities.Attendance.filter({
      student_id: student.student_id || student.id,
      class_name: student.class_name,
      section: student.section,
      academic_year: academic_year
    });

    console.log(`Total attendance records: ${attendance.length}`);

    // Filter by date range if provided
    let rangeRecords = attendance;
    if (start_date && end_date) {
      rangeRecords = attendance.filter(a => a.date >= start_date && a.date <= end_date);
    }

    // Get all working dates (not holidays)
    const holidays = await base44.asServiceRole.entities.Holiday.filter({
      academic_year: academic_year,
      status: 'Active'
    });
    const holidaySet = new Set(holidays.map(h => h.date));

    // Deduplicate and get working dates with attendance
    const uniqueWorkingDates = new Set();
    const fullDayDates = [];
    const halfDayDates = [];
    const absentDates = [];

    rangeRecords.forEach(a => {
      if (!a.is_holiday && a.attendance_type !== 'holiday') {
        // Check if it's a Sunday
        const dayOfWeek = new Date(a.date + 'T00:00:00').getDay();
        const isSunday = dayOfWeek === 0;
        
        if (!holidaySet.has(a.date) && !isSunday) {
          uniqueWorkingDates.add(a.date);
          
          if (a.attendance_type === 'full_day') {
            fullDayDates.push(a.date);
          } else if (a.attendance_type === 'half_day') {
            halfDayDates.push(a.date);
          } else if (a.attendance_type === 'absent') {
            absentDates.push(a.date);
          }
        }
      }
    });

    const workingDays = Array.from(uniqueWorkingDates).sort();

    return Response.json({
      student: {
        name: student.name,
        id: student.student_id || student.id,
        class: student.class_name,
        section: student.section
      },
      summary: {
        total_working_days: workingDays.length,
        full_days: fullDayDates.length,
        half_days: halfDayDates.length,
        absent_days: absentDates.length
      },
      working_days_list: workingDays,
      full_day_dates: fullDayDates.sort(),
      half_day_dates: halfDayDates.sort(),
      absent_dates: absentDates.sort(),
      date_range: start_date && end_date ? { from: start_date, to: end_date } : 'all records'
    });
  } catch (error) {
    console.error('Debug error:', error);
    return Response.json(
      { error: error.message || 'Failed to debug attendance dates' },
      { status: 500 }
    );
  }
});