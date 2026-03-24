// Serves the OneSignal SDK Service Worker content with correct MIME type.
// This allows OneSignal to register its worker without needing /OneSignalSDKWorker.js at root.

Deno.serve(async (req) => {
  const workerScript = `
importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");
`;

  return new Response(workerScript, {
    status: 200,
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
});