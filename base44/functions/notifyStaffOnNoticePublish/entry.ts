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

    // PUSH DISABLED TEMPORARILY

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStaffOnNoticePublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});