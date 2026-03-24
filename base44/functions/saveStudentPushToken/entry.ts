import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, player_id } = await req.json();

    if (!student_id || !player_id) {
      return Response.json({ error: 'Missing student_id or player_id' }, { status: 400 });
    }

    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({ student_id });

    if (prefs.length > 0) {
      await base44.asServiceRole.entities.StudentNotificationPreference.update(prefs[0].id, {
        browser_push_enabled: true,
        browser_push_token: player_id,
      });
    } else {
      await base44.asServiceRole.entities.StudentNotificationPreference.create({
        student_id,
        notifications_enabled: true,
        browser_push_enabled: true,
        browser_push_token: player_id,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[saveStudentPushToken] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});