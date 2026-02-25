import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = 'BEu90Ej8bFj1i1EVc5UzpZwIqXBfAl30wfVW7zqHRqaXGvBH1NZSKMJJjFRUBk-25YyJPcW2vJMGm7YzYMZ6q6I';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_ids, title, message, url, icon } = await req.json();

    if (!student_ids || !student_ids.length) {
      return Response.json({ error: 'Missing student_ids' }, { status: 400 });
    }

    if (!VAPID_PRIVATE_KEY) {
      return Response.json({ error: 'VAPID_PRIVATE_KEY not configured' }, { status: 500 });
    }

    webpush.setVapidDetails(
      'mailto:admin@school.com',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    // Get all prefs with push tokens for these students
    const allPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefMap = new Map(allPrefs.map(p => [p.student_id, p]));

    const payload = JSON.stringify({
      title: title || 'New Notification',
      body: message || '',
      icon: icon || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg',
      badge: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg',
      data: { url: url || '/' },
      vibrate: [200, 100, 200],
    });

    let sent = 0;
    let failed = 0;
    const errors = [];

    for (const sid of student_ids) {
      const pref = prefMap.get(sid);
      if (!pref || !pref.browser_push_enabled || !pref.browser_push_token) continue;

      try {
        const subscription = JSON.parse(pref.browser_push_token);
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (err) {
        failed++;
        errors.push({ student_id: sid, error: err.message });
        // If subscription is invalid/expired, clear it
        if (err.statusCode === 410 || err.statusCode === 404) {
          try {
            await base44.asServiceRole.entities.StudentNotificationPreference.update(pref.id, {
              browser_push_token: null,
              browser_push_enabled: false
            });
          } catch {}
        }
      }
    }

    return Response.json({ success: true, sent, failed, errors });
  } catch (error) {
    console.error('sendStudentPushNotification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});