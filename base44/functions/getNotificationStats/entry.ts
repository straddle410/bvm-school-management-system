import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { notification_id } = await req.json();

    if (!notification_id) {
      return Response.json({ error: 'notification_id is required' }, { status: 400 });
    }

    const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
    const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');

    if (!ONESIGNAL_REST_API_KEY || !ONESIGNAL_APP_ID) {
      return Response.json({ error: 'OneSignal not configured' }, { status: 500 });
    }

    const url = `https://onesignal.com/api/v1/notifications/${notification_id}?app_id=${ONESIGNAL_APP_ID}`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      console.error('[getNotificationStats] OneSignal API error:', res.status, errorData);
      return Response.json({ 
        error: 'Failed to fetch notification stats', 
        status: res.status,
        details: errorData 
      }, { status: res.status });
    }

    const data = await res.json();

    // Return simplified stats
    return Response.json({
      notification_id: data.id,
      recipients: data.recipients || 0,
      successful: data.successful || 0,
      failed: data.failed || 0,
      converted: data.converted || 0,
      opened: data.opened || 0,
    });

  } catch (error) {
    console.error('[getNotificationStats] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});