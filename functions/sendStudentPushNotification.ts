import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import webpush from 'npm:web-push@3.6.7';

Deno.serve(async (req) => {
  try {
    const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
      console.error('[SendPush] Missing VAPID keys');
      return Response.json({ error: 'VAPID keys not configured' }, { status: 500 });
    }

    webpush.setVapidDetails('mailto:admin@school.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('[SendPush] VAPID configured, key prefix:', VAPID_PUBLIC_KEY.substring(0, 20) + '...');

    const base44 = createClientFromRequest(req);
    const { student_ids, title, message, url, icon, receipt_no } = await req.json();
    const baseUrl = 'https://bvmse.in';
    const notificationUrl = receipt_no ? `${baseUrl}/StudentDashboard?openFees=1&receiptNo=${receipt_no}` : (url ? `${baseUrl}${url}` : `${baseUrl}/StudentDashboard`);

    if (!student_ids || !student_ids.length) {
      return Response.json({ error: 'Missing student_ids' }, { status: 400 });
    }

    const payload = JSON.stringify({
      title: title || 'New Notification',
      body: message || '',
      icon: icon || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg',
      badge: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg',
      click_action: notificationUrl,
      data: { url: notificationUrl },
      vibrate: [200, 100, 200],
    });

    console.log('[SendPush] Payload:', payload);

    // Fetch prefs for the specific student_ids only
    const allPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefMap = new Map(allPrefs.map(p => [p.student_id, p]));

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const sid of student_ids) {
      const pref = prefMap.get(sid);
      if (!pref || !pref.browser_push_token) {
        console.warn('[SendPush] Push skipped: student has no registered device token', sid);
        continue;
      }
      if (!pref.browser_push_enabled) {
        console.warn('[SendPush] Push skipped: student has push disabled', sid);
        continue;
      }

      let subscription;
      try {
        subscription = JSON.parse(pref.browser_push_token);
      } catch {
        console.error('[SendPush] Invalid JSON token for student:', sid);
        failed++;
        errors.push({ student_id: sid, error: 'Invalid subscription JSON' });
        continue;
      }

      if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
        console.error('[SendPush] Subscription missing required fields for student:', sid, {
          has_endpoint: !!subscription.endpoint,
          has_p256dh: !!subscription.keys?.p256dh,
          has_auth: !!subscription.keys?.auth,
        });
        failed++;
        errors.push({ student_id: sid, error: 'Subscription missing endpoint/keys' });
        continue;
      }

      console.log('[SendPush] Sending to student:', sid, 'endpoint prefix:', subscription.endpoint.substring(0, 50) + '...');

      try {
        const result = await webpush.sendNotification(subscription, payload);
        console.log('[SendPush] ✅ Success for', sid, 'status:', result.statusCode);
        sent++;
      } catch (err) {
        console.error('[SendPush] ❌ Failed for', sid, 'status:', err.statusCode, 'error:', err.message);
        failed++;
        errors.push({ student_id: sid, error: err.message, statusCode: err.statusCode });
        // Clear invalid/expired subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          try {
            await base44.asServiceRole.entities.StudentNotificationPreference.update(pref.id, {
              browser_push_token: null,
              browser_push_enabled: false,
            });
            console.log('[SendPush] Cleared expired token for student:', sid);
          } catch {}
        }
      }
    }

    console.log('[SendPush] Done. sent:', sent, 'failed:', failed, 'skipped:', student_ids.length - sent - failed);
    // Return sent > 0 as success only if at least one device received the push
    return Response.json({ success: sent > 0, sent, failed, errors });
  } catch (error) {
    console.error('[SendPush] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});