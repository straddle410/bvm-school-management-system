Deno.serve(() => {
  const script = `
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
self.addEventListener('push', () => {});
self.addEventListener('notificationclick', () => {});
`;
  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
});