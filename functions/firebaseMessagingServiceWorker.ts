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

  let data = {
    title: 'BVM School',
    body: 'You have a new notification',
    icon: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg',
    badge: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      data = {
        title: parsed.title || data.title,
        body: parsed.body || parsed.message || data.body,
        icon: parsed.icon || data.icon,
        badge: parsed.badge || data.badge,
        data: { action_url: parsed.click_action || parsed.data?.url || '/' },
        vibrate: parsed.vibrate || [200, 100, 200],
        requireInteraction: false,
        tag: parsed.tag || 'bvm-notification',
      };
    } catch {
      data.body = event.data.text();
    }
  }

  console.log('[SW] Showing notification:', data.title, data.body);

  event.waitUntil(
    self.registration.showNotification(data.title, data)
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