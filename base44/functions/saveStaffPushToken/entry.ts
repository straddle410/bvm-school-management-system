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

    return Response.json({ success: true });
  } catch (error) {
    console.error('[saveStaffPushToken] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});