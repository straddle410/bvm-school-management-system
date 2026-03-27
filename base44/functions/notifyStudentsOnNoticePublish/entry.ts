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
    const externalUserIds = [];

    // --- Student notifications ---
    if (notifyStudents) {
      // Fetch student prefs for push filtering
      const studentPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
      const prefsByStudentId = Object.fromEntries(
        studentPrefs.map(p => [p.student_id, p])
      );

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
          const pref = prefsByStudentId[student.student_id];
          const canSendPush = willSendPush && pref && pref.browser_push_enabled;

          const msgRecord = await base44.asServiceRole.entities.Message.create({
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
            is_push_sent: canSendPush,
          });

          notified++;

          if (canSendPush) {
            externalUserIds.push(`student_${student.student_id}`);
          }
        } catch (err) {
          console.error(`[notifyStudentsOnNoticePublish] Failed for ${student.student_id}:`, err.message);
        }
      }
    }

    // --- Staff notifications ---
    if (notifyStaff && notice.sendPushNotification === true) {
      const staffPrefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({});
      const staffIds = staffPrefs
        .filter(p => p.browser_push_enabled && p.staff_id)
        .map(p => p.staff_id);

      console.log(`[notifyStudentsOnNoticePublish] Staff push eligible (${staffIds.length}):`, JSON.stringify(staffIds));

      for (const staffId of staffIds) {
        externalUserIds.push(`staff_${staffId}`);
      }
    }

    // PUSH DISABLED TEMPORARILY — OneSignal block commented out
    // if (externalUserIds.length > 0) { ... }

    return Response.json({ success: true, notified, push_sent: 0 });
  } catch (error) {
    console.error('[notifyStudentsOnNoticePublish] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});