import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // PUSH DISABLED TEMPORARILY
    return Response.json({ success: true, message: 'Push disabled temporarily' });

    const { student_ids, title, message, url } = await req.json();

    if (!student_ids || !student_ids.length) {
      return Response.json({ error: 'Missing student_ids' }, { status: 400 });
    }

    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return Response.json({ error: 'OneSignal not configured' }, { status: 500 });
    }

    // Build external_user_ids with student_ prefix (matches frontend OneSignal.login())
    const externalUserIds = student_ids.map(id => `student_${id}`);

    const body = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: externalUserIds,
      contents: { en: message || '' },
      headings: { en: title || 'New Notification' },
      ...(url ? { url } : {}),
    };

    console.log('[SendStudentPush] Sending to', externalUserIds.length, 'students via OneSignal');

    const res = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    console.log('[SendStudentPush] OneSignal response:', JSON.stringify(data));

    if (res.ok) {
      await base44.asServiceRole.entities.PushNotificationLog.create({
        one_signal_notification_id: data.id || 'unknown',
        target_type: 'student',
        target_user_ids: externalUserIds,
        title: title || 'New Notification',
        message: (message || '').substring(0, 100),
        recipients_count: data.recipients ?? externalUserIds.length,
        status: 'sent',
        context_type: 'custom_student_push',
        context_id: 'batch',
        sent_date: new Date().toISOString(),
      });
      return Response.json({ success: true, sent: data.recipients ?? 0, onesignal: data });
    } else {
      await base44.asServiceRole.entities.PushNotificationLog.create({
        one_signal_notification_id: data.id || 'unknown',
        target_type: 'student',
        target_user_ids: externalUserIds,
        title: title || 'New Notification',
        message: (message || '').substring(0, 100),
        recipients_count: externalUserIds.length,
        status: 'failed',
        error_message: data.errors?.[0] || JSON.stringify(data),
        context_type: 'custom_student_push',
        context_id: 'batch',
        sent_date: new Date().toISOString(),
      });
      return Response.json({ success: false, sent: 0, error: data, status: res.status }, { status: res.status });
    }
  } catch (error) {
    console.error('[SendStudentPush] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});