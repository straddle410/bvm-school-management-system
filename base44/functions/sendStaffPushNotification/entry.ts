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

    // Central safety check — respect global NotificationSettings
    const settingsList = await base44.asServiceRole.entities.NotificationSettings.list();
    const settings = settingsList[0];
    console.log('[SendStaffPush] DEBUG enable_push:', settings?.enable_push);
    if (!settings || settings.enable_push != true) {
      console.log('[SendStaffPush] Push disabled, skipping staff notification.');
      return Response.json({ success: true, sent: 0, reason: 'Push notifications disabled' });
    }

    const { staff_ids, staff_emails, title, message, url } = await req.json();

    // Support staff_ids (new) or staff_emails (legacy fallback)
    const identifiers = staff_ids || staff_emails;
    const useStaffId = !!staff_ids;

    if (!identifiers || identifiers.length === 0) {
      return Response.json({ success: true, sent: 0 });
    }

    // Get push tokens — filter by staff_id (preferred) or staff_email (legacy)
    const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({});
    const targets = prefs.filter(p => {
      const match = useStaffId
        ? identifiers.includes(p.staff_id)
        : identifiers.includes(p.staff_email);
      return match && p.browser_push_enabled && p.browser_push_token;
    });

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