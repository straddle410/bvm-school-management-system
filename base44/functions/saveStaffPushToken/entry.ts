import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, browser_push_token, staff_name } = await req.json();

    if (!staff_id || !browser_push_token) {
      return Response.json({ error: 'staff_id and browser_push_token are required' }, { status: 400 });
    }

    const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({ staff_id });

    if (prefs.length > 0) {
      await base44.asServiceRole.entities.StaffNotificationPreference.update(prefs[0].id, {
        browser_push_token,
        browser_push_enabled: true,
        ...(staff_name ? { staff_name } : {}),
      });
      console.log('[saveStaffPushToken] Updated token for staff_id:', staff_id);
    } else {
      await base44.asServiceRole.entities.StaffNotificationPreference.create({
        staff_id,
        browser_push_token,
        browser_push_enabled: true,
        ...(staff_name ? { staff_name } : {}),
      });
      console.log('[saveStaffPushToken] Created new record for staff_id:', staff_id);
    }

    // Register device in OneSignal
    try {
      const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
      const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
      if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
        const parsedSub = typeof browser_push_token === 'string' ? JSON.parse(browser_push_token) : browser_push_token;
        const endpoint = parsedSub?.endpoint;
        if (endpoint) {
          const osRes = await fetch('https://onesignal.com/api/v1/players', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              app_id: ONESIGNAL_APP_ID,
              device_type: 5,
              identifier: endpoint,
              external_user_id: staff_id,
            }),
          });
          const osData = await osRes.json();
          if (osData.id) {
            const latestPrefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({ staff_id });
            if (latestPrefs.length > 0) {
              await base44.asServiceRole.entities.StaffNotificationPreference.update(latestPrefs[0].id, {
                onesignal_player_id: osData.id,
              });
            }
            console.log('[saveStaffPushToken] OneSignal player registered:', osData.id);
          } else {
            console.warn('[saveStaffPushToken] OneSignal registration failed:', JSON.stringify(osData));
          }
        }
      }
    } catch (osErr) {
      console.warn('[saveStaffPushToken] OneSignal registration error (non-fatal):', osErr.message);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[saveStaffPushToken] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});