Deno.serve((req) => {
  const swCode = `
// BVM School Push Notification Service Worker
// Served at /api/functions/firebaseMessagingServiceWorker
// Registered with scope: / — works in Android PWA and Chrome browser

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[SW] Push event received');

  let title = 'BVM School';
  let body = 'You have a new notification';
  let actionUrl = '/';

  if (event.data) {
    try {
      const parsed = event.data.json();
      title = parsed.title || title;
      body = parsed.body || parsed.message || body;
      actionUrl = parsed.click_action || (parsed.data && parsed.data.url) || '/';
    } catch {
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
    data: { action_url: actionUrl },
  };

  console.log('[SW] Showing notification:', title, body);

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.action_url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
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