import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, staff_name } = await req.json();

    if (!staff_id) {
      return Response.json({ error: 'staff_id is required' }, { status: 400 });
    }

    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error('[saveStaffPushToken] Missing OneSignal credentials');
      return Response.json({ error: 'OneSignal not configured' }, { status: 500 });
    }

    // Register staff as external user in OneSignal
    const osRes = await fetch('https://onesignal.com/api/v1/players', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        device_type: 5, // web push
        external_user_id: staff_id,
      }),
    });

    const osData = await osRes.json();
    console.log('[saveStaffPushToken] OneSignal response:', JSON.stringify(osData));

    const playerId = osData.id;
    if (!playerId) {
      console.warn('[saveStaffPushToken] OneSignal did not return player id:', JSON.stringify(osData));
      return Response.json({ error: 'OneSignal registration failed', detail: osData }, { status: 500 });
    }

    // Upsert StaffNotificationPreference with onesignal_player_id
    const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({ staff_id });

    if (prefs.length > 0) {
      await base44.asServiceRole.entities.StaffNotificationPreference.update(prefs[0].id, {
        onesignal_player_id: playerId,
        browser_push_enabled: true,
        ...(staff_name ? { staff_name } : {}),
      });
      console.log('[saveStaffPushToken] Updated onesignal_player_id for staff_id:', staff_id);
    } else {
      await base44.asServiceRole.entities.StaffNotificationPreference.create({
        staff_id,
        onesignal_player_id: playerId,
        browser_push_enabled: true,
        ...(staff_name ? { staff_name } : {}),
      });
      console.log('[saveStaffPushToken] Created new record for staff_id:', staff_id);
    }

    return Response.json({ success: true, onesignal_player_id: playerId });
  } catch (error) {
    console.error('[saveStaffPushToken] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});