import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Fires when a Message is created where sender_role = 'student'
// Notifies the recipient staff member (individual) or all teachers (for class messages to staff)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.sender_role !== 'student') {
      return Response.json({ success: true, notified: 0 });
    }

    const message = data;
    const messageId = event?.entity_id || message.id;

    // Determine target staff recipients
    let staffEmails = [];

    if (message.recipient_type === 'individual' && message.recipient_id) {
      // Individual message to a specific teacher/admin
      staffEmails = [message.recipient_id];
    } else {
      // Class/section message from student — notify all teachers assigned to that class
      if (message.recipient_class) {
        const teachers = await base44.asServiceRole.entities.StaffAccount.filter({
          is_active: true
        });
        staffEmails = teachers
          .filter(t =>
            t.classes_assigned && t.classes_assigned.includes(message.recipient_class)
          )
          .map(t => t.email)
          .filter(Boolean);
      }
    }

    if (staffEmails.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // DB-level dedup
    const existing = await base44.asServiceRole.entities.Notification.filter({
      type: 'student_message',
      related_entity_id: messageId,
    });
    const alreadyNotified = new Set(existing.map(n => n.recipient_staff_id));

    let notified = 0;

    for (const email of staffEmails) {
      if (alreadyNotified.has(email)) continue;
      try {
        await base44.asServiceRole.entities.Notification.create({
          recipient_staff_id: email,
          type: 'student_message',
          title: `Message from ${message.sender_name || 'Student'}`,
          message: message.subject || (message.body || '').substring(0, 100),
          related_entity_id: messageId,
          action_url: '/Messaging',
          is_read: false,
        });
        notified++;
      } catch (err) {
        console.error(`Failed to notify staff ${email}:`, err.message);
      }
    }

    // Push notifications for staff with tokens
    if (notified > 0) {
      try {
        const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({});
        for (const pref of prefs) {
          if (
            staffEmails.includes(pref.staff_email) &&
            pref.browser_push_enabled &&
            pref.browser_push_token &&
            pref.notify_on_student_message !== false
          ) {
            await base44.asServiceRole.functions.invoke('sendStaffPushNotification', {
              staff_emails: [pref.staff_email],
              title: `Message from ${message.sender_name || 'Student'}`,
              message: message.subject || (message.body || '').substring(0, 80),
              url: '/Messaging',
            });
          }
        }
      } catch (pushErr) {
        console.error('Push send error (non-fatal):', pushErr.message);
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStaffOnStudentMessage:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});