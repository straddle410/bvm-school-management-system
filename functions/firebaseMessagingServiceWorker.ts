Deno.serve((req) => {
  const swCode = `
self.addEventListener('push', function(event) {
  console.log('[ServiceWorker] Push event received:', event);
  const data = event.data ? event.data.json() : {};
  const title = data.notification?.title || 'New Notification';
  const options = {
    body: data.notification?.body || '',
    icon: data.notification?.icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: data.data || {}
  };
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[ServiceWorker] Notification clicked:', event.notification.tag);
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.url || '/')
  );
});
  `;

  return new Response(swCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
});