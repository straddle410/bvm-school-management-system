import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get access token for Google Drive
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googledrive');

    if (!accessToken) {
      return Response.json({ error: 'Google Drive not authorized' }, { status: 401 });
    }

    // The user will call this endpoint after selecting a folder in the browser
    // The browser-side code will use the Google Picker API (which requires client-side auth)
    // So this endpoint just returns the access token to verify auth status
    return Response.json({
      success: true,
      message: 'Google Drive is authorized. Ready for folder selection.',
      hasAccessToken: !!accessToken
    });
  } catch (error) {
    console.error('Drive folder selection error:', error);
    return Response.json(
      { error: 'Failed to check Google Drive authorization' },
      { status: 500 }
    );
  }
});