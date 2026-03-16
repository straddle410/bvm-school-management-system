import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { examTypeId, examTypeName, academicYear, applicableClasses } = await req.json();

    if (!examTypeId || !examTypeName || !academicYear) {
      return Response.json({ error: 'Missing required fields: examTypeId, examTypeName, academicYear' }, { status: 400 });
    }

    console.log('[sendExamMarksPublishedNotification] Processing exam:', examTypeName, 'year:', academicYear, 'classes:', applicableClasses);

    // Fetch all students for the given academic year and applicable classes
    const studentFilter = { academic_year: academicYear, status: 'Published' };
    const allStudents = await base44.asServiceRole.entities.Student.filter(studentFilter);

    // Filter by applicable classes if provided
    const targetStudents = (applicableClasses && applicableClasses.length > 0)
      ? allStudents.filter(s => applicableClasses.includes(s.class_name))
      : allStudents;

    console.log('[sendExamMarksPublishedNotification] Target students count:', targetStudents.length);

    const notificationUrl = `/StudentMarks?examType=${encodeURIComponent(examTypeName)}`;
    const title = `${examTypeName} Marks Published`;
    const body = `Your ${examTypeName} exam marks are published.`;

    let sent = 0, skipped = 0, failed = 0;

    for (const student of targetStudents) {
      const studentId = student.student_id;
      if (!studentId) continue;

      const contextId = `${examTypeId}_${studentId}`;

      // Duplicate check — skip if already notified for this exam + student
      try {
        const existing = await base44.asServiceRole.entities.Message.filter({
          context_type: 'marks_publish',
          context_id: contextId,
        });
        if (existing.length > 0) {
          console.log('[sendExamMarksPublishedNotification] Skipping duplicate for student:', studentId);
          skipped++;
          continue;
        }
      } catch (dupErr) {
        console.error('[sendExamMarksPublishedNotification] Duplicate check error:', dupErr.message);
      }

      // Send push notification
      try {
        await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
          student_ids: [studentId],
          title,
          message: body,
          url: notificationUrl,
        });
      } catch (pushErr) {
        console.error('[sendExamMarksPublishedNotification] Push failed for student:', studentId, pushErr.message);
        // Continue — still create the Message entity so badge shows up
      }

      // Create Message entity for deduplication and in-app badge/notification
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
          context_type: 'marks_publish',
          context_id: contextId,
        });
        sent++;
      } catch (msgErr) {
        console.error('[sendExamMarksPublishedNotification] Message create failed for student:', studentId, msgErr.message);
        failed++;
      }
    }

    console.log('[sendExamMarksPublishedNotification] Done. sent:', sent, 'skipped:', skipped, 'failed:', failed);
    return Response.json({ success: true, sent, skipped, failed, exam: examTypeName });
  } catch (error) {
    console.error('[sendExamMarksPublishedNotification] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});