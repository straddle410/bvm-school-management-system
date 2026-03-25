import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, player_id, student_name } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id is required' }, { status: 400 });
    }
    if (!player_id) {
      return Response.json({ error: 'player_id is required' }, { status: 400 });
    }

    // Upsert StudentNotificationPreference with the player_id from the frontend SDK
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({ student_id });

    if (prefs.length > 0) {
      await base44.asServiceRole.entities.StudentNotificationPreference.update(prefs[0].id, {
        onesignal_player_id: player_id,
        browser_push_enabled: true,
        ...(student_name ? { student_name } : {}),
      });
      console.log('[saveStudentPushToken] Updated player_id for student_id:', student_id, 'player_id:', player_id);
    } else {
      await base44.asServiceRole.entities.StudentNotificationPreference.create({
        student_id,
        onesignal_player_id: player_id,
        browser_push_enabled: true,
        notifications_enabled: true,
        ...(student_name ? { student_name } : {}),
      });
      console.log('[saveStudentPushToken] Created new record for student_id:', student_id, 'player_id:', player_id);
    }

    return Response.json({ success: true, onesignal_player_id: player_id });
  } catch (error) {
    console.error('[saveStudentPushToken] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});