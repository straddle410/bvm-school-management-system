import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const { student_id, academic_year, class_name } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Use service role to fetch all data (no auth required for student dashboard)
    const [marks, attendance, notices, homework, submissions] = await Promise.all([
      base44.asServiceRole.entities.Marks.filter({ student_id, status: 'Published' }, '-created_date', 50).catch(() => []),
      base44.asServiceRole.entities.Attendance.filter({ student_id, academic_year }, '-date', 30).catch(() => []),
      base44.asServiceRole.entities.Notice.filter({ status: 'Published' }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.Homework.filter({ class_name, status: 'Published' }, '-due_date', 10).catch(() => []),
      base44.asServiceRole.entities.HomeworkSubmission.filter({ student_id }, '-created_date', 100).catch(() => []),
    ]);

    return Response.json({ data: { marks: marks || [], attendance: attendance || [], notices: notices || [], homework: homework || [], submissions: submissions || [] } });
  } catch (error) {
    console.error('getStudentData error:', error);
    return Response.json({ data: { marks: [], attendance: [], notices: [], homework: [], submissions: [] } }, { status: 200 });
  }
});