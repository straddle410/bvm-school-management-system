import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Central safety check — respect global NotificationSettings
    const settingsList = await base44.asServiceRole.entities.NotificationSettings.list();
    const settings = settingsList?.[0];
    console.log('[SendStudentPush] enable_push:', settings?.enable_push);

    if (!settings || settings.enable_push != true) {
      console.log('[SendStudentPush] Push disabled, skipping.');
      return Response.json({ success: true, sent: 0, reason: 'Push notifications disabled' });
    }

    const { student_ids, title, message, url } = await req.json();

    if (!student_ids || !student_ids.length) {
      return Response.json({ error: 'Missing student_ids' }, { status: 400 });
    }

    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error('[SendStudentPush] Missing OneSignal credentials');
      return Response.json({ error: 'OneSignal not configured' }, { status: 500 });
    }

    const body = {
      app_id: ONESIGNAL_APP_ID,
      include_external_user_ids: student_ids,
      contents: { en: message || '' },
      headings: { en: title || 'New Notification' },
      ...(url ? { url } : {}),
    };

    console.log('[SendStudentPush] Sending to', student_ids.length, 'students via OneSignal');

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

    return Response.json({ success: true, sent: data.recipients ?? 0, onesignal: data });
  } catch (error) {
    console.error('[SendStudentPush] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});