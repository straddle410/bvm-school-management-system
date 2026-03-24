Deno.serve(() => {
  const swContent = `importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');`;

  return new Response(swContent, {
    status: 200,
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  });
});