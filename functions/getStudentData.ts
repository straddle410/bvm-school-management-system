import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, academic_year, class_name } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }

    // Use service role to fetch all data
    const [marks, attendance, allNotices, homework, submissions] = await Promise.all([
      base44.asServiceRole.entities.Marks.filter({ student_id, status: 'Published' }, '-created_date', 50),
      base44.asServiceRole.entities.Attendance.filter({ student_id, academic_year }, '-date', 30),
      base44.asServiceRole.entities.Notice.filter({ status: 'Published' }, '-created_date', 20),
      base44.asServiceRole.entities.Homework.filter({ class_name, status: 'Published' }, '-due_date', 10),
      base44.asServiceRole.entities.HomeworkSubmission.filter({ student_id }, '-created_date', 100),
    ]);

    // Filter notices: show if audience is All/Parents/Staff, or if Students with no class filter, or if class matches
    const notices = allNotices.filter(n => {
      if (n.target_audience === 'Students') {
        if (n.target_classes && n.target_classes.length > 0) {
          return n.target_classes.includes(class_name);
        }
        return true; // Students - all classes
      }
      return true; // All, Parents, Staff, Teachers - show to everyone
    });

    return Response.json({ marks, attendance, notices, homework, submissions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});