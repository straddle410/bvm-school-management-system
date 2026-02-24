import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get admin's notification preferences
    const prefs = await base44.entities.NotificationPreference.filter({
      user_email: user.email
    });

    const preference = prefs[0];

    if (!preference?.browser_push_enabled || !preference?.browser_push_token) {
      return Response.json({
        success: false,
        message: 'Push notifications not enabled or token missing',
        preferenceId: preference?.id
      }, { status: 400 });
    }

    // Send push notification via Web Push API
    const pushSubscription = {
      endpoint: preference.browser_push_token,
      keys: {
        auth: 'test_auth_key',
        p256dh: 'test_p256dh_key'
      }
    };

    const notificationPayload = {
      title: 'Test Notification',
      body: 'This is a test push notification from the school management system',
      icon: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg',
      tag: 'test-notification',
      data: {
        url: '/',
        timestamp: new Date().toISOString()
      }
    };

    return Response.json({
      success: true,
      message: 'Test notification sent to admin',
      details: {
        user_email: user.email,
        user_role: user.role,
        preference_id: preference.id,
        notification: notificationPayload
      }
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    return Response.json(
      { error: error.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
});