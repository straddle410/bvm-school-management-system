import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { student_id } = payload;

    if (!student_id) {
      return Response.json({ error: 'student_id is required' }, { status: 400 });
    }

    // Fetch student
    const students = await base44.entities.Student.filter({ student_id });
    if (!students.length) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }
    const student = students[0];

    // Get current academic year
    const years = await base44.entities.AcademicYear.filter({ status: 'Active' });
    const currentYear = years[0]?.year || student.academic_year;

    // Fetch timetable for student's class and section
    const timetables = await base44.entities.Timetable.filter({
      class_name: student.class_name,
      section: student.section,
      academic_year: currentYear,
      status: 'Published'
    });

    // Sort by day, then start_time
    const dayOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sorted = timetables.sort((a, b) => {
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      if (dayDiff !== 0) return dayDiff;
      return a.start_time.localeCompare(b.start_time);
    });

    return Response.json({
      success: true,
      student_id: student.student_id,
      class_name: student.class_name,
      section: student.section,
      academic_year: currentYear,
      timetable: sorted.map(t => ({
        id: t.id,
        day: t.day,
        start_time: t.start_time,
        end_time: t.end_time,
        subject: t.subject,
        teacher_name: t.teacher_name,
        room_number: t.room_number || '',
        notes: t.notes || ''
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});