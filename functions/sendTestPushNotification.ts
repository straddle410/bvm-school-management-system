import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = 'BEu90Ej8bFj1i1EVc5UzpZwIqXBfAl30wfVW7zqHRqaXGvBH1NZSKMJJjFRUBk-25YyJPcW2vJMGm7YzYMZ6q6I';

Deno.serve(async (req) => {
  try {
    const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
    if (!VAPID_PRIVATE_KEY) {
      return Response.json({ error: 'VAPID_PRIVATE_KEY not configured' }, { status: 500 });
    }

    webpush.setVapidDetails('mailto:admin@school.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const base44 = createClientFromRequest(req);
    const { student_id } = await req.json();

    let subscription = null;
    let targetLabel = '';

    if (student_id) {
      // Send to a specific student
      const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({ student_id });
      const pref = prefs[0];
      console.log('[TestPush] Student pref found:', !!pref, 'token:', !!pref?.browser_push_token, 'enabled:', pref?.browser_push_enabled);

      if (!pref?.browser_push_token) {
        return Response.json({
          success: false,
          error: 'No push token found for student. Student must enable push notifications first.',
          debug: { student_id, pref_found: !!pref, token_present: false }
        }, { status: 400 });
      }

      try {
        subscription = JSON.parse(pref.browser_push_token);
        targetLabel = `student:${student_id}`;
      } catch {
        return Response.json({ success: false, error: 'Stored token is not valid JSON. Student must re-enable push notifications.' }, { status: 400 });
      }
    } else {
      // Send to the calling admin user
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Not authenticated' }, { status: 401 });

      const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({ user_email: user.email });
      const pref = prefs[0];
      console.log('[TestPush] Staff pref found:', !!pref, 'token:', !!pref?.browser_push_token);

      if (!pref?.browser_push_token) {
        return Response.json({ success: false, error: 'No push token for your account. Enable push notifications first.' }, { status: 400 });
      }

      try {
        subscription = JSON.parse(pref.browser_push_token);
        targetLabel = `staff:${user.email}`;
      } catch {
        return Response.json({ success: false, error: 'Stored token is not valid JSON. Re-enable push notifications.' }, { status: 400 });
      }
    }

    // Validate subscription has required fields
    if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
      console.error('[TestPush] Invalid subscription object:', JSON.stringify(subscription));
      return Response.json({
        success: false,
        error: 'Subscription missing required fields (endpoint/keys.p256dh/keys.auth). Re-enable push notifications.',
        debug: {
          has_endpoint: !!subscription.endpoint,
          has_p256dh: !!subscription.keys?.p256dh,
          has_auth: !!subscription.keys?.auth,
          endpoint_preview: subscription.endpoint?.substring(0, 60)
        }
      }, { status: 400 });
    }

    console.log('[TestPush] Sending to:', targetLabel, 'endpoint:', subscription.endpoint.substring(0, 60) + '...');

    const payload = JSON.stringify({
      title: '🔔 Test Notification',
      body: `Push notifications are working! Sent to ${targetLabel} at ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`,
      icon: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg',
      tag: 'test-push',
      click_action: '/',
    });

    await webpush.sendNotification(subscription, payload);
    console.log('[TestPush] ✅ Sent successfully to:', targetLabel);

    return Response.json({
      success: true,
      message: `Test push sent to ${targetLabel}`,
      endpoint_preview: subscription.endpoint.substring(0, 60) + '...',
    });

  } catch (error) {
    console.error('[TestPush] Error:', error.message, 'statusCode:', error.statusCode);
    return Response.json({
      success: false,
      error: error.message,
      statusCode: error.statusCode,
    }, { status: 500 });
  }
});