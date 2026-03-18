import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:admin@school.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_emails, title, message, url } = await req.json();

    if (!staff_emails || staff_emails.length === 0) {
      return Response.json({ success: true, sent: 0 });
    }

    // Get push tokens for the given emails
    const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({});
    const targets = prefs.filter(p =>
      staff_emails.includes(p.staff_email) &&
      p.browser_push_enabled &&
      p.browser_push_token
    );

    if (targets.length === 0) {
      return Response.json({ success: true, sent: 0 });
    }

    let sent = 0;
    const payload = JSON.stringify({ title, body: message, url });

    for (const pref of targets) {
      try {
        let subscription;
        try {
          subscription = typeof pref.browser_push_token === 'string'
            ? JSON.parse(pref.browser_push_token)
            : pref.browser_push_token;
        } catch {
          continue;
        }
        await webpush.sendNotification(subscription, payload);
        sent++;
      } catch (err) {
        console.error(`Push failed for ${pref.staff_email}:`, err.message);
        // If subscription is invalid, disable it
        if (err.statusCode === 410) {
          try {
            await base44.asServiceRole.entities.StaffNotificationPreference.update(pref.id, {
              browser_push_enabled: false,
              browser_push_token: null,
            });
          } catch {}
        }
      }
    }

    return Response.json({ success: true, sent });
  } catch (error) {
    console.error('Error in sendStaffPushNotification:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});