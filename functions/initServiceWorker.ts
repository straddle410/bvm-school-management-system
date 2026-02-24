// This is a placeholder to serve the service worker file
// The actual service worker code is registered via the Layout component

Deno.serve(async (req) => {
  if (req.method === 'POST') {
    return Response.json({ success: true });
  }
  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});