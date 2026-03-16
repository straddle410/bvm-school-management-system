import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const notice = data;
    const target_audience = notice.target_audience || 'All';
    const target_classes = notice.target_classes || [];

    // Only notify students if audience is All or Students
    if (target_audience !== 'Students' && target_audience !== 'All') {
      return Response.json({ success: true, notified: 0 });
    }

    const currentAcademicYear = notice.academic_year || '2024-25';

    let students = await base44.asServiceRole.entities.Student.filter({
      status: 'Published',
      academic_year: currentAcademicYear,
    });

    if (target_audience === 'Students' && target_classes.length > 0) {
      students = students.filter(s => target_classes.includes(s.class_name));
    }

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    let notified = 0;
    const pushStudentIds = [];

    for (const student of students) {
      try {
        const contextId = `${notice.id}_${student.student_id}`;

        // Deduplication check via Message entity
        const existing = await base44.asServiceRole.entities.Message.filter({
          recipient_id: student.student_id,
          context_type: 'notice_posted',
          context_id: contextId,
        });

        if (existing.length > 0) {
          console.log(`[notifyStudentsOnNoticePublish] Duplicate skipped for ${student.student_id}`);
          continue;
        }

        // Create Message entity (in-app notification + dedup record)
        await base44.asServiceRole.entities.Message.create({
          sender_id: 'system',
          sender_name: 'School',
          sender_role: 'admin',
          recipient_type: 'individual',
          recipient_id: student.student_id,
          recipient_name: student.name,
          subject: notice.title,
          body: (notice.content || '').substring(0, 200),
          is_read: false,
          academic_year: currentAcademicYear,
          context_type: 'notice_posted',
          context_id: contextId,
        });

        notified++;

        if (notice.sendPushNotification === true) {
          pushStudentIds.push(student.student_id);
        }
      } catch (err) {
        console.error(`[notifyStudentsOnNoticePublish] Failed for ${student.student_id}:`, err.message);
      }
    }

    // Send push only if admin explicitly enabled it
    if (pushStudentIds.length > 0) {
      try {
        await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
          student_ids: pushStudentIds,
          title: notice.title,
          message: (notice.content || '').substring(0, 100),
          url: `/StudentNotices`,
        });
        console.log(`[notifyStudentsOnNoticePublish] Push sent to ${pushStudentIds.length} students`);
      } catch (pushErr) {
        console.error('[notifyStudentsOnNoticePublish] Push failed (non-fatal):', pushErr.message);
      }
    }

    return Response.json({ success: true, notified, push_sent: pushStudentIds.length });
  } catch (error) {
    console.error('[notifyStudentsOnNoticePublish] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});