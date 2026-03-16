Deno.serve((req) => {
  const swCode = `
// BVM School Push Notification Service Worker
// Served at /api/functions/firebaseMessagingServiceWorker
// Registered with scope: / — works in Android PWA and Chrome browser

self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker');
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push event received', event);
  console.log('[SW] Push payload:', event.data ? event.data.text() : null);

  let title = 'BVM School';
  let body = 'You have a new notification';
  let actionUrl = '/';

  if (event.data) {
    try {
      const parsed = event.data.json();
      console.log('[SW] Parsed push data:', JSON.stringify(parsed));
      title = parsed.title || title;
      body = parsed.body || parsed.message || body;
      actionUrl = parsed.click_action || (parsed.data && parsed.data.url) || '/';
    } catch (e) {
      console.log('[SW] JSON parse failed, using text:', e.message);
      body = event.data.text() || body;
    }
  }

  const icon = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg';

  const options = {
    body: body,
    icon: icon,
    badge: icon,
    vibrate: [200, 100, 200],
    tag: 'bvm-school-notification',
    renotify: true,
    requireInteraction: false,
    data: { url: actionUrl, action_url: actionUrl },
  };

  console.log('[SW] Displaying notification:', title, body);

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] showNotification() completed successfully'))
      .catch((err) => console.error('[SW] showNotification() FAILED:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || event.notification.data?.action_url || '/StudentDashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('bvmse.in') && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
`;

  return new Response(swCode, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
});