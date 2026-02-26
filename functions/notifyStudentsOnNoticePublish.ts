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
    const target_classes = notice.target_classes || []; // [] means all classes

    // Only notify students if audience is All or Students
    if (target_audience !== 'All' && target_audience !== 'Students') {
      return Response.json({ success: true, notified: 0 });
    }

    // Get all active students (both Published and Approved statuses are used)
    const [studentsPublished, studentsApproved] = await Promise.all([
      base44.asServiceRole.entities.Student.filter({ status: 'Published' }),
      base44.asServiceRole.entities.Student.filter({ status: 'Approved' }),
    ]);
    let students = [...studentsPublished, ...studentsApproved];
    // Deduplicate by student_id
    const seenIds = new Set();
    students = students.filter(s => {
      if (seenIds.has(s.student_id)) return false;
      seenIds.add(s.student_id);
      return true;
    });

    // Filter by target_classes if specified
    if (target_classes.length > 0) {
      students = students.filter(s => target_classes.includes(s.class_name));
    }

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get notification preferences
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefMap = new Map(prefs.map(p => [p.student_id, p]));

    let notified = 0;
    const duplicateCheck = new Set();

    for (const student of students) {
      const duplicateKey = `notice_${notice.id}_${student.student_id}`;
      if (duplicateCheck.has(duplicateKey)) continue;
      duplicateCheck.add(duplicateKey);

      // Check for existing notification to avoid duplicates
      try {
        const existing = await base44.asServiceRole.entities.Notification.filter({
          recipient_student_id: student.student_id,
          related_entity_id: notice.id,
          type: 'notice_posted'
        });
        if (existing.length > 0) continue;
      } catch {}

      // Create notification for ALL students (no preference gate for in-app badge)
      try {
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: student.student_id,
          type: 'notice_posted',
          title: notice.title,
          message: (notice.content || '').replace(/<[^>]*>/g, '').substring(0, 100),
          related_entity_id: notice.id,
          action_url: '/Notices',
          is_read: false
        });
        notified++;
      } catch (err) {
        console.error(`Failed to create notification for ${student.student_id}:`, err);
      }
    }

    // Push notifications for students who opted in
    if (notified > 0) {
      try {
        const pushStudentIds = students
          .filter(s => {
            const p = prefMap.get(s.student_id);
            return p && p.notifications_enabled && p.browser_push_enabled && p.browser_push_token;
          })
          .map(s => s.student_id);

        if (pushStudentIds.length > 0) {
          await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
            student_ids: pushStudentIds,
            title: notice.title,
            message: (notice.content || '').replace(/<[^>]*>/g, '').substring(0, 100),
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