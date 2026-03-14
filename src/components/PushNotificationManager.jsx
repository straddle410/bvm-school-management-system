import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function PushNotificationManager() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [studentSession, setStudentSession] = useState(null);

  useEffect(() => {
    // Get student session if exists
    try {
      const session = localStorage.getItem('student_session');
      if (session) setStudentSession(JSON.parse(session));
    } catch {}

    // Detect iOS PWA and show prompt if needed
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;

    if (isIOS && isPWA && Notification.permission === 'default') {
      setShowIOSPrompt(true);
      return; // Don't auto-request on iOS
    }
  }, []);

  const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowIOSPrompt(false);
        // Trigger the subscription process
        await initPushNotifications();
      } else {
        toast.error("Notifications blocked. Enable in iPhone Settings");
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      toast.error("Failed to enable notifications");
    }
  };

  const initPushNotifications = async () => {
    try {
      console.log('[PushNotificationManager] Initializing push notifications...');

      // Register inline service worker
      if ('serviceWorker' in navigator) {
        console.log('[ServiceWorker] Registering inline service worker...');
        const swCode = `
          import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
          import { getMessaging, onBackgroundMessage } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';

          const firebaseConfig = {
            apiKey: '${import.meta.env.VITE_FIREBASE_API_KEY || ''}',
            authDomain: '${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || ''}',
            projectId: '${import.meta.env.VITE_FCM_PROJECT_ID || ''}',
            messagingSenderId: '${import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || ''}',
            appId: '${import.meta.env.VITE_FIREBASE_APP_ID || ''}',
          };

          const app = initializeApp(firebaseConfig);
          const messaging = getMessaging(app);

          onBackgroundMessage(messaging, (payload) => {
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

        const blob = new Blob([swCode], { type: 'application/javascript' });
        const swUrl = URL.createObjectURL(blob);
        
        try {
          const registration = await navigator.serviceWorker.register(swUrl);
          console.log('[ServiceWorker] Registered successfully:', registration);
        } catch (error) {
          console.error('[ServiceWorker] Registration failed:', error);
          // Fallback: try to register from public folder
          try {
            await navigator.serviceWorker.register('/firebase-messaging-sw.js');
            console.log('[ServiceWorker] Registered from public folder');
          } catch (fallbackError) {
            console.error('[ServiceWorker] Fallback registration also failed:', fallbackError);
          }
        }
      }

      // Handle student notifications
      if (studentSession?.student_id) {
        console.log('[PushNotificationManager] Student session detected, initializing student push...');
        await initStudentPushNotifications();
        return;
      }

      // Handle staff/admin notifications
      const hasStaffSession = !!localStorage.getItem('staff_session');
      if (hasStaffSession) {
        console.log('[PushNotificationManager] Staff session detected, skipping push init');
        return;
      }

      // Base44 authenticated users
      const user = await base44.auth.me().catch(() => null);
      if (!user) {
        console.log('[PushNotificationManager] No authenticated user');
        return;
      }

      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: user.email
      });
      const pref = prefs[0];

      if (!pref?.browser_push_enabled) {
        console.log('[PushNotificationManager] Push notifications not enabled in preferences');
        return;
      }

      // Get Firebase messaging token via service worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          
          // Request push subscription from service worker
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey
          });
          
          const token = subscription.endpoint;
          console.log('[PushNotificationManager] Token obtained:', token?.substring(0, 20) + '...');
          
          if (token) {
            await base44.auth.updateMe({
              browser_push_token: token
            });
            console.log('[PushNotificationManager] Token saved to user');
            toast.success("Notifications enabled successfully!");
          }
        } catch (error) {
          console.error('[PushNotificationManager] Failed to get token:', error);
          toast.error("Failed to enable notifications");
        }
      }
    } catch (error) {
      console.error('[PushNotificationManager] Setup failed:', error);
      toast.error("Notification setup failed");
    }
  };

  const initStudentPushNotifications = async () => {
    try {
      console.log('[PushNotificationManager] Setting up student push notifications...');
      
      // Get or create student notification preference
      const prefs = await base44.entities.StudentNotificationPreference.filter({
        student_id: studentSession.student_id
      });
      let pref = prefs[0];

      if (!pref) {
        console.log('[PushNotificationManager] Creating new student notification preference');
        pref = await base44.entities.StudentNotificationPreference.create({
          student_id: studentSession.student_id,
          notifications_enabled: true,
          browser_push_enabled: true,
          sound_enabled: true,
          sound_volume: 0.7,
          message_notifications: true,
          quiz_notifications: true,
        });
      }

      if (!pref?.browser_push_enabled) {
        console.log('[PushNotificationManager] Student push notifications not enabled');
        return;
      }

      // Get Firebase messaging token via service worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidKey
          });
          
          const token = subscription.endpoint;
          console.log('[PushNotificationManager] Student token obtained:', token?.substring(0, 20) + '...');
          
          if (token) {
            await base44.entities.StudentNotificationPreference.update(pref.id, {
              browser_push_token: token
            });
            console.log('[PushNotificationManager] Student token saved');
            toast.success("Student notifications enabled!");
          }
        } catch (error) {
          console.error('[PushNotificationManager] Failed to get student token:', error);
          toast.error("Failed to enable student notifications");
        }
      }
    } catch (error) {
      console.error('[PushNotificationManager] Student setup failed:', error);
    }
  };

  useEffect(() => {
    // Auto-run for non-iOS or if permission already granted
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches;

    // iOS limitation check - must be PWA
    if (isIOS && !isPWA) {
      toast.info("To receive notifications on iPhone: Open in Safari > Share > Add to Home Screen");
      return;
    }

    // Skip auto-init on iOS PWA if permission not granted yet (wait for button click)
    if (isIOS && isPWA && Notification.permission === 'default') {
      console.log('[PushNotificationManager] Waiting for iOS permission...');
      return;
    }

    // Auto-init for non-iOS or already granted
    if (!isIOS || Notification.permission === 'granted') {
      console.log('[PushNotificationManager] Auto-initializing...');
      initPushNotifications();
    }
  }, [studentSession]);

  return (
    <>
      {showIOSPrompt && (
        <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4">
          <Button
            onClick={handleEnableNotifications}
            className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg text-base py-6 px-8 rounded-full"
          >
            🔔 Enable Notifications
          </Button>
        </div>
      )}
    </>
  );
}