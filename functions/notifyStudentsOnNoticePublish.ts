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
    const target_classes = notice.target_classes || []; // empty = all classes

    // Only notify students if audience is All or Students
    if (target_audience !== 'Students' && target_audience !== 'All') {
      return Response.json({ success: true, notified: 0 });
    }

    // Get all approved students
    let students = await base44.asServiceRole.entities.Student.filter({ status: 'Approved' });

    // Filter by target classes if specified
    if (target_audience === 'Students' && target_classes.length > 0) {
      students = students.filter(s => target_classes.includes(s.class_name));
    }

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Check for existing notifications to avoid duplicates
    const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
      type: 'notice_posted',
      related_entity_id: notice.id,
    });
    const alreadyNotified = new Set(existingNotifs.map(n => n.recipient_student_id));

    let notified = 0;

    for (const student of students) {
      // Skip if already notified
      if (alreadyNotified.has(student.student_id)) continue;

      try {
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: student.student_id,
          type: 'notice_posted',
          title: notice.title,
          message: (notice.content || '').substring(0, 100),
          related_entity_id: notice.id,
          action_url: '/Notices',
          is_read: false,
        });
        notified++;
      } catch (err) {
        console.error(`Failed to notify ${student.student_id}:`, err.message);
      }
    }

    // Send push notifications to students with push tokens
    if (notified > 0) {
      try {
        const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
        const prefMap = new Map(prefs.map(p => [p.student_id, p]));

        const pushStudentIds = students
          .filter(s => {
            const p = prefMap.get(s.student_id);
            return p && p.browser_push_enabled && p.browser_push_token;
          })
          .map(s => s.student_id);

        if (pushStudentIds.length > 0) {
          await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
            student_ids: pushStudentIds,
            title: notice.title,
            message: (notice.content || '').substring(0, 100),
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