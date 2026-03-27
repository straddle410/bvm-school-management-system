import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    console.log("FUNCTION CALLED: sendStaffPushNotification");
    const base44 = createClientFromRequest(req);

    // PUSH DISABLED TEMPORARILY
    return Response.json({ success: true, message: 'Push disabled temporarily' });

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
      include_external_user_ids: externalUserIds,
      contents: { en: message || '' },
      headings: { en: title || 'New Notification' },
      ...(url ? { url } : {}),
    };

    console.log('[SendStaffPush] Sending to', externalUserIds.length, 'staff via OneSignal');

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