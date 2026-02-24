// Service Worker for handling background push notifications
// This worker handles notifications when app is closed or in background

self.addEventListener('push', (event) => {
  const options = {
    icon: '/notification-icon.png',
    badge: '/notification-badge.png',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  if (event.data) {
    try {
      const data = event.data.json();
      options.body = data.body || 'New notification';
      options.title = data.title || 'Notification';
      options.tag = data.tag || `notif-${Date.now()}`;
      options.data = data.data || {};
    } catch (e) {
      options.body = event.data.text();
      options.title = 'Notification';
    }
  }

  event.waitUntil(
    self.registration.showNotification(options.title, options)
  );
});

// Handle notification clicks with deep linking
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const actionUrl = event.notification.data?.action_url || '/StudentDashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if app window already exists
      for (let client of clientList) {
        if (client.url.includes(self.location.origin)) {
          // Navigate to the action URL
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            actionUrl: actionUrl,
          });
          return client.focus();
        }
      }
      // Open new window if not found
      if (clients.openWindow) {
        return clients.openWindow(actionUrl);
      }
    })
  );
});

// Handle service worker activation
self.addEventListener('activate', (event) => {
  event.waitUntil(Promise.resolve());
});

// Keep service worker alive
self.addEventListener('sync', (event) => {
  // Placeholder for background sync
});