import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Respect global push settings
    const settingsList = await base44.asServiceRole.entities.NotificationSettings.list();
    const settings = settingsList?.[0];
    if (!settings || settings.enable_push !== true) {
      console.log('[SendStaffPush] Push disabled, skipping.');
      return Response.json({ success: true, sent: 0, reason: 'Push notifications disabled' });
    }

    const { staff_ids, title, message, url } = await req.json();

    if (!staff_ids || !staff_ids.length) {
      return Response.json({ error: 'Missing staff_ids' }, { status: 400 });
    }

    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return Response.json({ error: 'OneSignal not configured' }, { status: 500 });
    }

    // Build external_user_ids with staff_ prefix
    // staff_ids must be actual staff.id (UUID) from StaffAccount, NOT staff_code
    const externalUserIds = staff_ids.map(id => `staff_${id}`);
    console.log('[SendStaffPush] external_user_ids:', JSON.stringify(externalUserIds));

    const body = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: externalUserIds,
      contents: { en: message || '' },
      headings: { en: title || 'New Notification' },
      ...(url ? { url } : {}),
    };

    console.log('[SendStaffPush] Sending to', externalUserIds.length, 'staff via OneSignal');

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log('[SendStaffPush] OneSignal request payload:', JSON.stringify(body));
    console.log('[SendStaffPush] OneSignal response status:', res.status);
    console.log('[SendStaffPush] OneSignal response:', JSON.stringify(data));

    if (!res.ok) {
      console.error('[SendStaffPush] OneSignal error:', res.status, JSON.stringify(data));
      return Response.json({ success: false, sent: 0, error: data, status: res.status }, { status: res.status });
    }

    return Response.json({ success: true, sent: data.recipients ?? 0, onesignal: data });
  } catch (error) {
    console.error('[SendStaffPush] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});