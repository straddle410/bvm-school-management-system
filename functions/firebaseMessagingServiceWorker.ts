Deno.serve((req) => {
  const swCode = `
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');

const firebaseConfig = {
  apiKey: '${Deno.env.get('VITE_FIREBASE_API_KEY') || ''}',
  authDomain: '${Deno.env.get('VITE_FIREBASE_AUTH_DOMAIN') || ''}',
  projectId: '${Deno.env.get('VITE_FCM_PROJECT_ID') || ''}',
  messagingSenderId: '${Deno.env.get('VITE_FIREBASE_MESSAGING_SENDER_ID') || ''}',
  appId: '${Deno.env.get('VITE_FIREBASE_APP_ID') || ''}',
};

const app = firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging(app);

messaging.onBackgroundMessage((payload) => {
  console.log('[FCM] Background message received:', payload);
  const notificationTitle = payload.notification?.title || 'Notification';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/favicon.ico',
    badge: payload.notification?.badge || '/favicon.ico',
    data: payload.data || {},
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[ServiceWorker] Notification clicked:', event.notification.tag);
  event.notification.close();
  const urlToOpen = event.notification.data?.click_action || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === urlToOpen && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('[ServiceWorker] Notification closed:', event.notification.tag);
});
  `;

  return new Response(swCode, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'no-cache',
    },
  });
});