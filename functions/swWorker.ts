// Service Worker for handling push notifications
// This runs in the background and handles push events

self.addEventListener('push', (event) => {
  const options = {
    icon: '/notification-icon.png',
    badge: '/notification-badge.png',
    requireInteraction: false,
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.body || 'New notification';
      options.title = data.title || 'Notification';
      options.tag = data.tag || 'notification';
    } catch (e) {
      options.body = event.data.text();
      options.title = 'Notification';
    }
  }

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let client of clientList) {
        if (client.url === '/' && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.resolve());
});