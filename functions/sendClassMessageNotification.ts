import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // Support both: called directly with params OR via entity automation with {event, data}
    let message_id, class_name, subject, msgBody, sender_name, recipient_type, recipient_id, recipient_section;

    if (body.event && body.data) {
      // Called from entity automation
      const msg = body.data;
      message_id = body.event?.entity_id || msg.id;
      recipient_type = msg.recipient_type;
      class_name = msg.recipient_class;
      recipient_section = msg.recipient_section;
      recipient_id = msg.recipient_id;
      subject = msg.subject;
      msgBody = msg.body;
      sender_name = msg.sender_name;
    } else {
      // Called directly
      message_id = body.message_id;
      recipient_type = body.recipient_type || 'class';
      class_name = body.class_name;
      recipient_section = body.recipient_section;
      recipient_id = body.recipient_id;
      subject = body.subject;
      msgBody = body.body;
      sender_name = body.sender_name;
    }

    if (!message_id) {
      return Response.json({ error: 'Missing message_id' }, { status: 400 });
    }

    let students = [];

    if (recipient_type === 'individual') {
      if (recipient_id) {
        const found = await base44.asServiceRole.entities.Student.filter({
          student_id: recipient_id,
          status: 'Approved'
        });
        students = found;
      }
    } else if (recipient_type === 'class' || recipient_type === 'section') {
      if (!class_name) {
        return Response.json({ success: true, notified: 0 });
      }
      const allInClass = await base44.asServiceRole.entities.Student.filter({
        class_name: class_name,
        status: 'Approved'
      });
      if (recipient_type === 'section' && recipient_section) {
        students = allInClass.filter(s => s.section === recipient_section);
      } else {
        students = allInClass;
      }
    }

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Check for existing notifications to avoid duplicates (DB-level)
    const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
      type: 'class_message',
      related_entity_id: message_id,
    });
    const alreadyNotified = new Set(existingNotifs.map(n => n.recipient_student_id));

    let notified = 0;

    for (const student of students) {
      if (alreadyNotified.has(student.student_id)) continue;

      try {
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: student.student_id,
          type: 'class_message',
          title: `Message from ${sender_name || 'Teacher'}`,
          message: subject || (msgBody || '').substring(0, 100),
          related_entity_id: message_id,
          action_url: '/StudentMessaging',
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
            title: `Message from ${sender_name || 'Teacher'}`,
            message: subject || (msgBody || '').substring(0, 80),
            url: '/StudentMessaging',
          });
        }
      } catch (pushErr) {
        console.error('Push send error (non-fatal):', pushErr.message);
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in sendClassMessageNotification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});