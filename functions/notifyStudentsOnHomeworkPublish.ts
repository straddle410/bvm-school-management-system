import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const homework = data;
    const class_name = homework.class_name;
    const section = homework.section;
    const academicYear = homework.academic_year || '2024-25';

    if (!class_name) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get all Published students in this class (filter section if specific)
    const studentFilter = { class_name, status: 'Published', academic_year: academicYear };
    if (section && section !== 'All') studentFilter.section = section;
    const students = await base44.asServiceRole.entities.Student.filter(studentFilter);

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    const title = 'New Homework Assigned';
    const body = homework.title || `Homework for ${homework.subject}`;
    let notified = 0;

    for (const student of students) {
      const studentId = student.student_id;
      if (!studentId) continue;

      const contextId = `${homework.id}_${studentId}`;

      // Deduplication check via Message entity
      const existing = await base44.asServiceRole.entities.Message.filter({
        context_type: 'homework_published',
        context_id: contextId,
      });
      if (existing.length > 0) continue;

      // Create Message entity
      try {
        await base44.asServiceRole.entities.Message.create({
          sender_id: 'system',
          sender_name: 'School',
          sender_role: 'admin',
          recipient_type: 'individual',
          recipient_id: studentId,
          recipient_name: student.name,
          subject: title,
          body,
          is_read: false,
          academic_year: academicYear,
          context_type: 'homework_published',
          context_id: contextId,
        });
        notified++;
      } catch (err) {
        console.error(`[notifyStudentsOnHomeworkPublish] Failed for ${studentId}:`, err.message);
      }
    }

    // Push not sent for homework (in-app badge via Message entity is sufficient)
    console.log('[notifyStudentsOnHomeworkPublish] Notified:', notified, 'students for homework:', homework.id);
    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('[notifyStudentsOnHomeworkPublish] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});