import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VAPID_PUBLIC_KEY = 'BEu90Ej8bFj1i1EVc5UzpZwIqXBfAl30wfVW7zqHRqaXGvBH1NZSKMJJjFRUBk-25YyJPcW2vJMGm7YzYMZ6q6I';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Get preference with token
    const prefs = await base44.asServiceRole.entities.NotificationPreference.filter({
      user_email: user.email
    });

    if (!prefs.length || !prefs[0].browser_push_token) {
      return Response.json({
        success: false,
        message: 'Push notifications not enabled or token missing',
        preferenceId: prefs[0]?.id
      }, { status: 400 });
    }

    const subscription = JSON.parse(prefs[0].browser_push_token);

    // Send push via Web Push API
    const payload = JSON.stringify({
      title: 'Test Notification',
      message: 'This is your test push notification!'
    });

    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `key=${Deno.env.get('FCM_SERVER_KEY') || ''}`
      },
      body: JSON.stringify({
        to: subscription.endpoint,
        notification: {
          title: 'Test Notification',
          body: 'This is your test push notification!',
          icon: '/icon-192x192.png'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`FCM error: ${response.status}`);
    }

    return Response.json({ success: true, message: 'Push notification sent' });
  } catch (error) {
    console.error('Push notification error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});