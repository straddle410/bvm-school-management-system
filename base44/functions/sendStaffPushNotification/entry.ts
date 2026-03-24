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

    const data = await res.json();
    console.log('[SendStaffPush] OneSignal request payload:', JSON.stringify(body));
    console.log('[SendStaffPush] OneSignal response status:', res.status);
    console.log('[SendStaffPush] OneSignal response:', JSON.stringify(data));

    if (!res.ok) {
      console.error('[SendStaffPush] OneSignal error:', res.status, JSON.stringify(data));
      // Log failed staff push
      try {
        await base44.asServiceRole.entities.PushNotificationLog.create({
          one_signal_notification_id: 'failed',
          target_type: 'staff',
          target_user_ids: externalUserIds,
          title: title || 'Staff Notification',
          message: message || '',
          recipients_count: externalUserIds.length,
          status: 'failed',
          context_type: 'staff_notification',
          context_id: 'manual',
          sent_date: new Date().toISOString(),
        });
      } catch (logErr) {
        console.error('[SendStaffPush] Failed to log error:', logErr.message);
      }
      return Response.json({ success: false, sent: 0, error: data, status: res.status }, { status: res.status });
    }

    // Log successful staff push
    try {
      await base44.asServiceRole.entities.PushNotificationLog.create({
        one_signal_notification_id: data.id || 'unknown',
        target_type: 'staff',
        target_user_ids: externalUserIds,
        title: title || 'Staff Notification',
        message: message || '',
        recipients_count: data.recipients || externalUserIds.length,
        status: 'sent',
        context_type: 'staff_notification',
        context_id: 'manual',
        sent_date: new Date().toISOString(),
      });
    } catch (logErr) {
      console.error('[SendStaffPush] Failed to log success:', logErr.message);
    }

    return Response.json({ success: true, sent: data.recipients ?? 0, onesignal: data });
  } catch (error) {
    console.error('[SendStaffPush] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});