import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (event.type !== 'update' || !data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const marks = data;
    const student_id = marks.student_id;

    if (!student_id) {
      return Response.json({ error: 'Missing student_id' }, { status: 400 });
    }

    // IDEMPOTENCY STRATEGY: Option A - Second verification inside creation
    // Check for existing notifications to avoid duplicates
    const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
      type: 'results_posted',
      related_entity_id: marks.id,
    });
    const alreadyNotified = new Set(existingNotifs.map(n => n.recipient_student_id));

    if (alreadyNotified.has(student_id)) {
      return Response.json({ success: true, notified: 0 });
    }

    let notified = 0;

    // FIX #1b-safe: Per-student race window closure
    try {
      // IDEMPOTENCY: Second micro-check right before create
      // Closes race window from initial check to create
      const existsNow = await base44.asServiceRole.entities.Notification.filter({
        type: 'results_posted',
        related_entity_id: marks.id,
        recipient_student_id: student_id,
      });
      
      if (existsNow.length > 0) {
        console.log(`Notification already exists for ${student_id}, skipping`);
        return Response.json({ success: true, notified: 0 });
      }

      // Create notification only if micro-check passed
      await base44.asServiceRole.entities.Notification.create({
        recipient_student_id: student_id,
        type: 'results_posted',
        title: 'Your Results Are Published',
        message: `${marks.subject} - ${marks.exam_type}`,
        related_entity_id: marks.id,
        action_url: '/Results',
        is_read: false,
        duplicate_key: `marks_${marks.id}_${student_id}`,
      });
      notified = 1;
    } catch (err) {
      // Catch duplicate creation attempts from concurrent calls
      if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
        console.warn(`Duplicate marks notification for ${student_id} detected, ignoring`);
        return Response.json({ success: true, notified: 0 });
      }
      console.error('Failed to create notification:', err.message);
      return Response.json({ success: true, notified: 0 });
    }

    // Send push notification if enabled
    try {
      const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
        student_id: student_id
      });
      const pref = prefs[0];
      if (pref && pref.browser_push_enabled && pref.browser_push_token) {
        await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
          student_ids: [student_id],
          title: 'Your Results Are Published',
          message: `${marks.subject} - ${marks.exam_type}`,
          url: '/Results',
        });
      }
    } catch (pushErr) {
      console.error('Push send error (non-fatal):', pushErr.message);
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStudentsOnMarksPublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});