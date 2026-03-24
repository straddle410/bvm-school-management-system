import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      console.error('[SendPush] Missing OneSignal credentials');
      return Response.json({ error: 'OneSignal credentials not configured' }, { status: 500 });
    }

    const base44 = createClientFromRequest(req);
    const { student_ids, title, message, url, receipt_no } = await req.json();

    if (!student_ids || !student_ids.length) {
      return Response.json({ error: 'Missing student_ids' }, { status: 400 });
    }

    const baseUrl = 'https://app.bvmse.in';
    const notificationUrl = receipt_no
      ? `${baseUrl}/StudentDashboard?openFees=1&receiptNo=${receipt_no}`
      : url ? `${baseUrl}${url}` : `${baseUrl}/StudentDashboard`;

    // Fetch all student prefs and build a map
    const allPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefMap = new Map(allPrefs.map(p => [p.student_id, p]));

    let sent = 0;
    let failed = 0;
    const errors = [];

    const pushTasks = student_ids.map(async (sid) => {
      const pref = prefMap.get(sid);
      if (!pref || !pref.browser_push_token) {
        console.log('[SendPush] No token for student:', sid);
        return { status: 'skipped', sid };
      }

      const playerId = pref.browser_push_token;

      try {
        const response = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_player_ids: [playerId],
            headings: { en: title || 'New Notification' },
            contents: { en: message || '' },
            url: notificationUrl,
          }),
        });

        const result = await response.json();
        if (response.ok && result.id) {
          console.log('[SendPush] ✅ Sent to student:', sid, 'notification_id:', result.id);
          return { status: 'success', sid };
        } else {
          console.error('[SendPush] ❌ OneSignal error for', sid, JSON.stringify(result));
          errors.push({ student_id: sid, error: JSON.stringify(result) });
          return { status: 'failed', sid };
        }
      } catch (err) {
        console.error('[SendPush] ❌ Failed for', sid, err.message);
        errors.push({ student_id: sid, error: err.message });
        return { status: 'failed', sid };
      }
    });

    const results = await Promise.all(pushTasks);
    sent = results.filter(r => r.status === 'success').length;
    failed = results.filter(r => r.status === 'failed').length;

    console.log('[SendPush] Done. sent:', sent, 'failed:', failed);
    return Response.json({ success: true, sent, failed, errors });
  } catch (error) {
    console.error('[SendPush] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});