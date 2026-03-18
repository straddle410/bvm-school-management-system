import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Fires when a Notice is published
// Notifies all active staff members
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const notice = data;
    const noticeId = event?.entity_id || notice.id;

    // Only notify staff if audience is All, Staff, or Teachers
    const audience = notice.target_audience || 'All';
    if (!['All', 'Staff', 'Teachers'].includes(audience)) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get all active staff
    const staffList = await base44.asServiceRole.entities.StaffAccount.filter({ is_active: true });
    const staffEmails = staffList
      .filter(s => s.email) // Skip records without email
      .map(s => s.email);

    if (staffEmails.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // DB-level dedup
    const existing = await base44.asServiceRole.entities.Notification.filter({
      type: 'notice_posted_staff',
      related_entity_id: noticeId,
    });
    const alreadyNotified = new Set(existing.map(n => n.recipient_staff_id));

    let notified = 0;

    // FIX #1b-safe: Promise.all with per-staff race window closure
    const notificationPromises = staffEmails
      .filter(email => !alreadyNotified.has(email))
      .map(async (email) => {
        try {
          // IDEMPOTENCY: Second micro-check right before create
          const existsNow = await base44.asServiceRole.entities.Notification.filter({
            type: 'notice_posted_staff',
            related_entity_id: noticeId,
            recipient_staff_id: email,
          });
          
          if (existsNow.length > 0) {
            return null;
          }

          const created = await base44.asServiceRole.entities.Notification.create({
            recipient_staff_id: email,
            type: 'notice_posted_staff',
            title: notice.title,
            message: (notice.content || '').substring(0, 120),
            related_entity_id: noticeId,
            action_url: '/Notices',
            is_read: false,
            duplicate_key: `notice_staff_${noticeId}_${email}`,
          });
          
          return created;
        } catch (err) {
          if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
            console.warn(`Duplicate notice notification for staff ${email} detected, ignoring`);
            return null;
          }
          console.error(`Failed to notify staff ${email}:`, err.message);
          return null;
        }
      });
    
    const results = await Promise.all(notificationPromises);
    notified = results.filter(r => r !== null).length;

    // FIX #4: Send push notifications to staff with enabled push
    if (notified > 0) {
      try {
        const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({});
        const prefMap = new Map(prefs.map(p => [p.staff_email, p]));

        const pushStaffEmails = staffEmails
          .filter(email => {
            const p = prefMap.get(email);
            return p && p.browser_push_enabled && p.browser_push_token;
          });

        if (pushStaffEmails.length > 0) {
          await base44.asServiceRole.functions.invoke('sendStaffPushNotification', {
            staff_emails: pushStaffEmails,
            title: `Notice: ${notice.title}`,
            message: (notice.content || '').substring(0, 100),
            url: '/Notices',
          }).catch(pushErr => {
            console.error('Staff push send error (non-fatal):', pushErr.message);
          });
        }
      } catch (pushErr) {
        console.error('Staff push delivery error (non-fatal):', pushErr.message);
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStaffOnNoticePublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});