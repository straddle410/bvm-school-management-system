import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, subscription } = await req.json();

    if (!student_id || !subscription) {
      return Response.json({ error: 'Missing student_id or subscription' }, { status: 400 });
    }

    // Validate student exists
    const students = await base44.asServiceRole.entities.Student.filter({ student_id });
    if (!students.length) {
      return Response.json({ error: 'Student not found' }, { status: 404 });
    }

    // Find or create preference
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({ student_id });

    // Handle disable (null subscription)
    if (!subscription) {
      if (prefs.length > 0) {
        await base44.asServiceRole.entities.StudentNotificationPreference.update(prefs[0].id, {
          browser_push_enabled: false,
          browser_push_token: null,
        });
      }
      return Response.json({ success: true });
    }

    const subscriptionStr = typeof subscription === 'string' ? subscription : JSON.stringify(subscription);

    if (prefs.length > 0) {
      await base44.asServiceRole.entities.StudentNotificationPreference.update(prefs[0].id, {
        browser_push_enabled: true,
        browser_push_token: subscriptionStr,
      });
    } else {
      await base44.asServiceRole.entities.StudentNotificationPreference.create({
        student_id,
        notifications_enabled: true,
        message_notifications: true,
        quiz_notifications: true,
        sound_enabled: true,
        browser_push_enabled: true,
        browser_push_token: subscriptionStr,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('saveStudentPushToken error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});