import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function PushNotificationManager() {
  useEffect(() => {
    const initPushNotifications = async () => {
      try {
        // Check if user is authenticated
        const user = await base44.auth.me().catch(() => null);
        if (!user) return;

        // Get user preferences
        const prefs = await base44.entities.NotificationPreference.filter({
          user_email: user.email
        });
        const pref = prefs[0];

        if (!pref?.browser_push_enabled) return;

        // Register service worker
        if ('serviceWorker' in navigator) {
          await navigator.serviceWorker.register('/service-worker.js');
        }

        // Subscribe to push
        if ('serviceWorker' in navigator && 'PushManager' in window) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array('BEu90Ej8bFj1i1EVc5UzpZwIqXBfAl30wfVW7zqHRqaXGvBH1NZSKMJJjFRUBk-25YyJPcW2vJMGm7YzYMZ6q6I'),
          });

          // Save token
          const token = JSON.stringify(subscription);
          await base44.auth.updateMe({
            browser_push_token: token
          });
        }
      } catch (error) {
        console.error('Push notification setup failed:', error);
      }
    };

    initPushNotifications();
  }, []);

  return null;
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}