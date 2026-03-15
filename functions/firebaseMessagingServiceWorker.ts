Deno.serve((req) => {
  const swCode = `
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

self.addEventListener('push', function(event) {
  console.log('[SW] Push received:', event.data?.text());

  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = {
      title: 'New Notification',
      body: event.data ? event.data.text() : ''
    };
  }

  const title = data.title || data.notification?.title || 'Fee Payment';
  const options = {
    body: data.body || data.notification?.body || 'New notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'fee-notification-' + Date.now(),
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    data: data
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW] Notification shown!'))
      .catch(err => console.log('[SW] Show failed:', err))
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[SW] Notification clicked:', event.notification.title);
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data?.click_action || '/')
  );
});

// Firebase background message handler
try {
  const firebaseConfig = {
    apiKey: self.VITE_FIREBASE_API_KEY,
    authDomain: self.VITE_FIREBASE_AUTH_DOMAIN,
    messagingSenderId: self.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: self.VITE_FIREBASE_APP_ID
  };

  // Only init if config looks valid
  if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();
    if (messaging) {
      messaging.onBackgroundMessage(function(payload) {
        console.log('[SW] Background message:', payload);
        const title = payload.notification?.title || payload.data?.title || 'Fee Payment';
        const options = {
          body: payload.notification?.body || payload.data?.body || 'New notification',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'fee-' + Date.now(),
          requireInteraction: true,
          silent: false,
          vibrate: [200, 100, 200]
        };
        return self.registration.showNotification(title, options);
      });
    }
  }
} catch(e) {
  console.log('[SW] Firebase init skipped:', e.message);
}
  `;

  return new Response(swCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
});