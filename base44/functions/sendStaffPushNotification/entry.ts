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
    // staff_ids must be actual staff.id (UUID from StaffAccount.id), NOT staff_code
    const externalUserIds = staff_ids.map(id => `staff_${id}`);
    console.log('[SendStaffPush] external_user_ids:', JSON.stringify(externalUserIds));

    const body = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: externalUserIds },
      target_channel: 'push',
      contents: { en: message || '' },
      headings: { en: title || 'New Notification' },
      ...(url ? { url } : {}),
    };

    console.log('[SendStaffPush] Sending to', externalUserIds.length, 'staff via OneSignal');
    console.log('[SendStaffPush] Request payload:', JSON.stringify(body));

    try {
      const res = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      
      if (res.ok) {
        console.log('[SendStaffPush] OneSignal sent to', externalUserIds.length, 'staff');
        // Log success
        await base44.asServiceRole.entities.PushNotificationLog.create({
          one_signal_notification_id: data.id || 'unknown',
          target_type: 'staff',
          target_user_ids: externalUserIds,
          title: title || 'New Notification',
          message: (message || '').substring(0, 100),
          recipients_count: data.recipients ?? externalUserIds.length,
          status: 'sent',
          context_type: 'custom_staff_push',
          context_id: 'batch',
          sent_date: new Date().toISOString(),
        });
        return Response.json({ success: true, sent: data.recipients ?? 0, onesignal: data });
      } else {
        console.error('[SendStaffPush] OneSignal failed:', res.status, JSON.stringify(data));
        // Log failure
        await base44.asServiceRole.entities.PushNotificationLog.create({
          one_signal_notification_id: data.id || 'unknown',
          target_type: 'staff',
          target_user_ids: externalUserIds,
          title: title || 'New Notification',
          message: (message || '').substring(0, 100),
          recipients_count: externalUserIds.length,
          status: 'failed',
          error_message: data.errors?.[0] || JSON.stringify(data),
          context_type: 'custom_staff_push',
          context_id: 'batch',
          sent_date: new Date().toISOString(),
        });
        return Response.json({ success: false, sent: 0, error: data, status: res.status }, { status: res.status });
      }
    } catch (networkErr) {
      console.error('[SendStaffPush] OneSignal network error:', networkErr.message);
      // Log network failure
      await base44.asServiceRole.entities.PushNotificationLog.create({
        one_signal_notification_id: 'network_error',
        target_type: 'staff',
        target_user_ids: externalUserIds,
        title: title || 'New Notification',
        message: (message || '').substring(0, 100),
        recipients_count: externalUserIds.length,
        status: 'failed',
        error_message: networkErr.message,
        context_type: 'custom_staff_push',
        context_id: 'batch',
        sent_date: new Date().toISOString(),
      });
      return Response.json({ success: false, sent: 0, error: networkErr.message }, { status: 500 });
    }
  } catch (error) {
    console.error('[SendStaffPush] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});