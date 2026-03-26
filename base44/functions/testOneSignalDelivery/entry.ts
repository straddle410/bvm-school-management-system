import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { external_user_id } = await req.json();
    if (!external_user_id) return Response.json({ error: 'external_user_id required' }, { status: 400 });

    const appId = Deno.env.get('ONESIGNAL_APP_ID');
    const apiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

    // Dry-run: fetch the subscription count for this external_user_id
    const subsRes = await fetch(
      `https://api.onesignal.com/apps/${appId}/users/by/external_id/${encodeURIComponent(external_user_id)}`,
      { headers: { Authorization: `Key ${apiKey}`, 'Content-Type': 'application/json' } }
    );

    const subsData = await subsRes.json();
    const subscriptions = subsData?.subscriptions || [];
    const activeSubscriptions = subscriptions.filter(s => s.type === 'ChromePush' || s.type === 'FirefoxPush' || s.type === 'SafariLegacyPush' || s.type === 'SafariPush');

    return Response.json({
      external_user_id,
      total_subscriptions: subscriptions.length,
      push_subscriptions: activeSubscriptions.length,
      recipients: activeSubscriptions.length,
      subscriptions: activeSubscriptions.map(s => ({ id: s.id, type: s.type, enabled: s.enabled })),
      raw_user: subsData
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});