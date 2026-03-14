// Firebase Cloud Messaging Service Worker
// This is a fallback for when the inline blob method is unavailable

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');

console.log('[Firebase-SW] Service worker loaded');

// Firebase configuration - will be provided by initialization script
let messaging = null;

function initializeFirebase(config) {
  try {
    const app = firebase.initializeApp(config);
    messaging = firebase.messaging(app);
    console.log('[Firebase-SW] Firebase initialized');
  } catch (error) {
    console.error('[Firebase-SW] Firebase initialization error:', error);
  }
}

// Handle background messages
if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    console.log('[FCM-SW] Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'Notification';
    const notificationOptions = {
      body: payload.notification?.body || '',
      icon: payload.notification?.icon || '/favicon.ico',
      badge: payload.notification?.badge || '/favicon.ico',
      data: payload.data || {},
    };
    
    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
}

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log('[FCM-SW] Notification clicked:', event.notification.tag);
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

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[FCM-SW] Notification closed:', event.notification.tag);
});

// Listen for messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FIREBASE') {
    console.log('[Firebase-SW] Received firebase config from main thread');
    initializeFirebase(event.data.config);
  }
});

console.log('[Firebase-SW] Service worker ready');