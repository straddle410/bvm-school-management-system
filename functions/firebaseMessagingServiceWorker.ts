Deno.serve((req) => {
  const swCode = `
self.addEventListener('push', function(event) {
  console.log('[SW] Push received!');
  console.log('[SW] Push data:', event.data?.text());
  
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    console.log('[SW] Failed to parse JSON, trying text');
    data = { 
      notification: { 
        title: 'New Notification', 
        body: event.data ? event.data.text() : '' 
      }
    };
  }
  
  const title = data.notification?.title || data.title || 'New Notification';
  const options = {
    body: data.notification?.body || data.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'fee-payment',
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    sound: 'default',
    data: data.data || {}
  };
  
  console.log('[ServiceWorker] Showing notification:', title, options.body);
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[ServiceWorker] Notification clicked:', event.notification.title);
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.click_action || '/')
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