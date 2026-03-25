import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, player_id, staff_name, staff_code } = await req.json();

    if (!staff_id) {
      return Response.json({ error: 'staff_id is required' }, { status: 400 });
    }
    if (!player_id) {
      return Response.json({ error: 'player_id is required' }, { status: 400 });
    }

    // Upsert StaffNotificationPreference with the player_id from the frontend SDK
    const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({ staff_id });

    if (prefs.length > 0) {
      await base44.asServiceRole.entities.StaffNotificationPreference.update(prefs[0].id, {
        onesignal_player_id: player_id,
        browser_push_enabled: true,
        ...(staff_name ? { staff_name } : {}),
        ...(staff_code ? { staff_code } : {}),
      });
      console.log('[saveStaffPushToken] Updated player_id for staff_id:', staff_id, 'player_id:', player_id);
    } else {
      await base44.asServiceRole.entities.StaffNotificationPreference.create({
        staff_id,
        onesignal_player_id: player_id,
        browser_push_enabled: true,
        ...(staff_name ? { staff_name } : {}),
        ...(staff_code ? { staff_code } : {}),
      });
      console.log('[saveStaffPushToken] Created new record for staff_id:', staff_id, 'player_id:', player_id);
    }

    return Response.json({ success: true, onesignal_player_id: player_id });
  } catch (error) {
    console.error('[saveStaffPushToken] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});