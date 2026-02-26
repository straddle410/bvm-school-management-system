import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const notice = data;
    const target_audience = notice.target_audience || 'All';

    // Get all students or filter by target audience
    let students = [];
    if (target_audience === 'Students' || target_audience === 'All') {
      students = await base44.asServiceRole.entities.Student.filter({
        status: 'Approved'
      });
    }

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get notification preferences for all students
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefMap = new Map(prefs.map(p => [p.student_id, p]));

    let notified = 0;
    const duplicateCheck = new Set();

    for (const student of students) {
      const pref = prefMap.get(student.student_id);

      if (!pref || !pref.notifications_enabled) {
        continue;
      }

      const duplicateKey = `notice_${notice.id}_${student.student_id}`;
      if (duplicateCheck.has(duplicateKey)) {
        continue;
      }
      duplicateCheck.add(duplicateKey);

      try {
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: student.student_id,
          type: 'notice_posted',
          title: notice.title,
          message: notice.content.substring(0, 100),
          related_entity_id: notice.id,
          action_url: '/Notices',
          is_read: false,
          duplicate_key: duplicateKey
        });

        notified++;
      } catch (err) {
        console.error(`Failed to create notification for ${student.student_id}:`, err);
      }
    }

    // Also send push notifications to all students with tokens
    if (notified > 0) {
      try {
        const studentIds = students
          .filter(s => {
            const p = prefMap.get(s.student_id);
            return p && p.notifications_enabled && p.browser_push_enabled && p.browser_push_token;
          })
          .map(s => s.student_id);

        if (studentIds.length > 0) {
          await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
            student_ids: studentIds,
            title: notice.title,
            message: notice.content?.substring(0, 100) || '',
            url: '/Notices',
          });
        }
      } catch (pushErr) {
        console.error('Push send error (non-fatal):', pushErr.message);
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStudentsOnNoticePublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});