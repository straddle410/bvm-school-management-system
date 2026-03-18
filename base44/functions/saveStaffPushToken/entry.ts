import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_email, staff_name, token } = await req.json();

    if (!staff_email || !token) {
      return Response.json({ error: 'Missing staff_email or token' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.StaffNotificationPreference.filter({
      staff_email
    });

    const tokenStr = typeof token === 'string' ? token : JSON.stringify(token);

    if (existing.length > 0) {
      await base44.asServiceRole.entities.StaffNotificationPreference.update(existing[0].id, {
        browser_push_enabled: true,
        browser_push_token: tokenStr,
        staff_name: staff_name || existing[0].staff_name,
      });
    } else {
      await base44.asServiceRole.entities.StaffNotificationPreference.create({
        staff_email,
        staff_name: staff_name || '',
        browser_push_enabled: true,
        browser_push_token: tokenStr,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Error in saveStaffPushToken:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});