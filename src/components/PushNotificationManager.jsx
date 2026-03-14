import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getVapidKey() {
  try {
    const response = await fetch('/api/functions/getVapidPublicKey');
    const data = await response.json();
    return data.vapidKey || data.key || data.publicKey;
  } catch (error) {
    console.error('[VAPID] Fetch failed:', error);
    return null;
  }
}

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

     // Get VAPID key directly
     const vapidKey = await getVapidKey();
     console.log('[VAPID] Key ready:', !!vapidKey);
     if (!vapidKey) {
       toast.error("Push notifications not configured");
       return;
     }

     // Register service worker from backend function
     if ('serviceWorker' in navigator) {
       console.log('[ServiceWorker] Registering service worker...');
       try {
         const swUrl = '/api/functions/firebaseMessagingServiceWorker';
         const registration = await navigator.serviceWorker.register(swUrl, { scope: '/' });
         console.log('[ServiceWorker] Registered successfully:', registration);
       } catch (error) {
         console.error('[ServiceWorker] Registration failed:', error);
       }
     }

     // Handle student notifications
     if (studentSession?.student_id) {
       console.log('[PushNotificationManager] Student session detected, initializing student push...');
       await initStudentPushNotifications();
       return;
     }

     // Handle staff/admin and base44 authenticated users
     const hasStaffSession = !!localStorage.getItem('staff_session');
     let user = null;
     let identifier = null;

     if (hasStaffSession) {
       try {
         const staffRaw = localStorage.getItem('staff_session');
         user = JSON.parse(staffRaw);
         identifier = user.staff_id || user.username;
         console.log('[PushNotificationManager] Staff session detected, identifier:', identifier);
       } catch {}
     } else {
       user = await base44.auth.me().catch(() => null);
       if (!user) {
         console.log('[PushNotificationManager] No authenticated user');
         return;
       }
       identifier = user.email;
     }

     if (!identifier) {
       console.log('[PushNotificationManager] No identifier found for user');
       return;
     }

     // Get or create notification preferences
     const prefs = await base44.entities.NotificationPreference.filter({
       user_email: identifier
     });
     let pref = prefs[0];

     if (!pref) {
       console.log('[PushNotificationManager] Creating new notification preference for', identifier);
       pref = await base44.entities.NotificationPreference.create({
         user_email: identifier,
         notifications_enabled: true,
         browser_push_enabled: true,
         sound_enabled: true,
         sound_volume: 0.7,
         message_notifications: true
       });
     }

     if (!pref?.browser_push_enabled) {
       console.log('[PushNotificationManager] Push notifications not enabled in preferences');
       return;
     }

     // Get push subscription token via service worker
     if ('serviceWorker' in navigator) {
       try {
         const registration = await navigator.serviceWorker.ready;
         const applicationServerKey = urlBase64ToUint8Array(vapidKey);

         const subscription = await registration.pushManager.subscribe({
           userVisibleOnly: true,
           applicationServerKey
         });

         const token = subscription.endpoint;
         console.log('[PushNotificationManager] Token obtained:', token?.substring(0, 20) + '...');

         if (token) {
           await base44.entities.NotificationPreference.update(pref.id, {
             browser_push_token: token
           });
           console.log('[PushNotificationManager] Token saved to preference');
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

      // Fetch VAPID key from backend first (ensure it's loaded before proceeding)
      let localVapidKey = vapidKey;
      if (!localVapidKey) {
        console.log('[VAPID] Fetching key from backend...');
        try {
          const response = await base44.functions.invoke('getVapidPublicKey', {});
          localVapidKey = response.data?.vapidKey;
        } catch (error) {
          console.error('[VAPID] Failed to fetch key:', error);
          toast.error("Push notifications not configured");
          return;
        }
      }

      if (!localVapidKey) {
        console.error('[VAPID] Key not available');
        toast.error("Push notifications not configured");
        return;
      }

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

      // Get push subscription token via service worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          console.log('[VAPID] Using key:', !!localVapidKey);
          const applicationServerKey = urlBase64ToUint8Array(localVapidKey);

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
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