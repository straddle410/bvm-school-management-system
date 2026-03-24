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
    const currentAcademicYear = notice.academic_year || '2024-25';

    const notifyStudents = target_audience === 'Students' || target_audience === 'All';
    const notifyStaff = target_audience === 'Staff' || target_audience === 'Teachers' || target_audience === 'All';

    if (!notifyStudents && !notifyStaff) {
      return Response.json({ success: true, notified: 0 });
    }

    let notified = 0;
    const pushStudentIds = [];

    // --- Student notifications ---
    if (notifyStudents) {
      let students = await base44.asServiceRole.entities.Student.filter({
        status: 'Published',
        academic_year: currentAcademicYear,
      });

      if (target_classes.length > 0) {
        students = students.filter(s => target_classes.includes(s.class_name));
      }

      for (const student of students) {
        try {
          const contextId = `${notice.id}_${student.student_id}`;

          const existing = await base44.asServiceRole.entities.Message.filter({
            recipient_id: student.student_id,
            context_type: 'notice_posted',
            context_id: contextId,
          });

          if (existing.length > 0) {
            console.log(`[notifyStudentsOnNoticePublish] Duplicate skipped for ${student.student_id}`);
            continue;
          }

          const willSendPush = notice.sendPushNotification === true;

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
            is_push_sent: willSendPush,
          });

          notified++;

          if (willSendPush) {
            pushStudentIds.push(student.student_id);
          }
        } catch (err) {
          console.error(`[notifyStudentsOnNoticePublish] Failed for ${student.student_id}:`, err.message);
        }
      }

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
          console.error('[notifyStudentsOnNoticePublish] Student push failed (non-fatal):', pushErr.message);
        }
      }
    }

    // --- Staff notifications ---
    if (notifyStaff && notice.sendPushNotification === true) {
      try {
        const staffPrefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({});
        const staffIds = staffPrefs
          .filter(p => p.browser_push_enabled && p.browser_push_token && p.staff_id)
          .map(p => p.staff_id);

        if (staffIds.length > 0) {
          await base44.asServiceRole.functions.invoke('sendStaffPushNotification', {
            staff_ids: staffIds,
            title: notice.title,
            message: (notice.content || '').substring(0, 100),
            url: `/Notices`,
          });
          console.log(`[notifyStudentsOnNoticePublish] Staff push sent to ${staffIds.length} staff`);
        }
      } catch (staffPushErr) {
        console.error('[notifyStudentsOnNoticePublish] Staff push failed (non-fatal):', staffPushErr.message);
      }
    }

    return Response.json({ success: true, notified, push_sent: pushStudentIds.length });
  } catch (error) {
    console.error('[notifyStudentsOnNoticePublish] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});