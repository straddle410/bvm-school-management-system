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
    let pushSent = 0;

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

        // Step 1: Create Message entity with is_push_sent: false (actual delivery not yet confirmed)
        const createdMessage = await base44.asServiceRole.entities.Message.create({
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
          is_push_sent: false,
        });

        notified++;

        // Step 2: Attempt push only if admin enabled it
        if (notice.sendPushNotification === true) {
          let pushSuccess = false;
          try {
            await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
              student_ids: [student.student_id],
              title: notice.title,
              message: (notice.content || '').substring(0, 100),
              url: `/StudentNotices`,
            });
            pushSuccess = true;
            console.log(`[notifyStudentsOnNoticePublish] Push sent for student: ${student.student_id}`);
          } catch (pushErr) {
            console.error(`[notifyStudentsOnNoticePublish] Push failed for ${student.student_id}:`, pushErr.message);
          }

          // Step 3: Update is_push_sent only after confirmed delivery
          if (pushSuccess) {
            try {
              await base44.asServiceRole.entities.Message.update(createdMessage.id, { is_push_sent: true });
              pushSent++;
            } catch (updateErr) {
              console.error(`[notifyStudentsOnNoticePublish] Failed to update is_push_sent for message ${createdMessage.id}:`, updateErr.message);
            }
          }
        }
      } catch (err) {
        console.error(`[notifyStudentsOnNoticePublish] Failed for ${student.student_id}:`, err.message);
      }
    }

    return Response.json({ success: true, notified, push_sent: pushSent });
  } catch (error) {
    console.error('[notifyStudentsOnNoticePublish] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});