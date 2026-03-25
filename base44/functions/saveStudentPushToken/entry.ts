import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, student_name } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id is required' }, { status: 400 });
    }

    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error('[saveStudentPushToken] Missing OneSignal credentials');
      return Response.json({ error: 'OneSignal not configured' }, { status: 500 });
    }

    // Register student as external user in OneSignal
    const osRes = await fetch('https://onesignal.com/api/v1/players', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        device_type: 5, // web push
        external_user_id: student_id,
      }),
    });

    const osData = await osRes.json();
    console.log('[saveStudentPushToken] OneSignal response:', JSON.stringify(osData));

    const playerId = osData.id;
    if (!playerId) {
      console.warn('[saveStudentPushToken] OneSignal did not return player id:', JSON.stringify(osData));
      return Response.json({ error: 'OneSignal registration failed', detail: osData }, { status: 500 });
    }

    // Upsert StudentNotificationPreference with onesignal_player_id
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({ student_id });

    if (prefs.length > 0) {
      await base44.asServiceRole.entities.StudentNotificationPreference.update(prefs[0].id, {
        onesignal_player_id: playerId,
        browser_push_enabled: true,
        ...(student_name ? { student_name } : {}),
      });
      console.log('[saveStudentPushToken] Updated onesignal_player_id for student_id:', student_id);
    } else {
      await base44.asServiceRole.entities.StudentNotificationPreference.create({
        student_id,
        onesignal_player_id: playerId,
        browser_push_enabled: true,
        notifications_enabled: true,
        ...(student_name ? { student_name } : {}),
      });
      console.log('[saveStudentPushToken] Created new record for student_id:', student_id);
    }

    return Response.json({ success: true, onesignal_player_id: playerId });
  } catch (error) {
    console.error('[saveStudentPushToken] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});