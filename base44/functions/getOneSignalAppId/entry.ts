import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Returns the OneSignal App ID for frontend SDK initialization.
// OneSignal App ID is a public identifier — safe to expose.
Deno.serve(async (req) => {
  try {
    const appId = Deno.env.get('ONESIGNAL_APP_ID');
    if (!appId) {
      return Response.json({ error: 'ONESIGNAL_APP_ID not configured' }, { status: 500 });
    }
    return Response.json({ appId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});