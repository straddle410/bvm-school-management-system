import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const diary = data;
    const class_name = diary.class_name;
    const section = diary.section;
    const academicYear = diary.academic_year || '2024-25';

    if (!class_name) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get all Published students in this class/section
    const studentFilter = { class_name, status: 'Published', academic_year: academicYear };
    if (section && section !== 'All') studentFilter.section = section;
    const students = await base44.asServiceRole.entities.Student.filter(studentFilter);

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    const title = 'Class Diary Published';
    const body = diary.title || `Class diary for Class ${class_name}`;
    let notified = 0;

    for (const student of students) {
      const studentId = student.student_id;
      if (!studentId) continue;

      const contextId = `${diary.id}_${studentId}`;

      // Deduplication check via Message entity
      const existing = await base44.asServiceRole.entities.Message.filter({
        context_type: 'diary_published',
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
          context_type: 'diary_published',
          context_id: contextId,
        });
        notified++;
      } catch (err) {
        console.error(`[notifyStudentsOnDiaryPublish] Failed for ${studentId}:`, err.message);
      }
    }

    // Push not sent for diary (in-app badge via Message entity is sufficient)
    console.log('[notifyStudentsOnDiaryPublish] Notified:', notified, 'students for diary:', diary.id);
    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('[notifyStudentsOnDiaryPublish] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});