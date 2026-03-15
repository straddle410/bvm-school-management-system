import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

function playNotificationSound() {
  const audio = new Audio('/notification.mp3');
  audio.volume = 0.5;
  
  document.addEventListener('click', () => {
    audio.play().catch(() => {});
  }, { once: true });
  
  // Try to play immediately (will work if user already interacted)
  audio.play().catch(() => {
    console.log('[Audio] Waiting for user interaction...');
  });
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

// Initialize Firebase
let firebaseApp = null;
let messaging = null;

async function initializeFirebase() {
  if (firebaseApp) return messaging;
  
  try {
    // Fetch Firebase config from backend function that has access to all secrets
    const response = await fetch('/api/functions/getFirebaseConfig');
    const firebaseConfig = await response.json();
    
    console.log('[Firebase] Initializing with config:', { 
      ...firebaseConfig, 
      apiKey: firebaseConfig.apiKey ? '***' : 'MISSING'
    });
    
    if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
      console.error('[Firebase] Missing required config values');
      return null;
    }
    
    firebaseApp = initializeApp(firebaseConfig);
    messaging = getMessaging(firebaseApp);
    console.log('[Firebase] Messaging initialized successfully');
    return messaging;
  } catch (error) {
    console.error('[Firebase] Initialization failed:', error);
    return null;
  }
}

export default function PushNotificationManager({ studentId }) {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [studentSession, setStudentSession] = useState(null);

  useEffect(() => {
    console.log('[PushInit] Mounted with:', studentId);
    console.log('[PushInit] Component mounted');
    console.log('[PushInit] All localStorage:', JSON.stringify(localStorage));
    console.log('[PushInit] student_id:', localStorage.getItem('student_id'));
    console.log('[PushInit] studentId:', localStorage.getItem('studentId'));
    console.log('[PushInit] student_token:', !!localStorage.getItem('student_token'));

    // Get student session if exists - use exact key from StudentLogin.jsx
    try {
      const sessionRaw = localStorage.getItem('student_session');
      console.log('[PushInit] student_session from localStorage:', sessionRaw ? 'EXISTS' : 'NOT FOUND');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        console.log('[PushInit] Parsed student_session:', JSON.stringify(session));
        const studentIdValue = session?.student_id || session?.id;
        console.log('[PushInit] Fixed studentId:', studentIdValue);
        setStudentSession(session);
      }
    } catch (e) {
      console.error('[PushInit] Failed to parse student_session:', e);
    }

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
     console.log('[Permission] Status:', Notification.permission);

     // Initialize Firebase Messaging
     const msg = await initializeFirebase();
     if (!msg) {
       toast.error("Firebase initialization failed");
       return;
     }

     // Get VAPID key
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

     // Get FCM token using Firebase SDK
     try {
       const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
       console.log('[Firebase] Requesting FCM token... iOS:', isIOS);
       
       const registration = await navigator.serviceWorker.ready;
       const token = await getToken(msg, {
         vapidKey: vapidKey,
         serviceWorkerRegistration: registration
       });

       console.log('[Firebase] FCM Token obtained:', token?.substring(0, 20) + '...');

       if (token) {
         await base44.entities.NotificationPreference.update(pref.id, {
           browser_push_token: token
         });
         console.log('[PushNotificationManager] Token saved to preference');
         toast.success("Notifications enabled successfully!");
         
         // Setup foreground message handler
         onMessage(msg, (payload) => {
           console.log('[Firebase] Foreground message received:', payload);
           playNotificationSound();
           if (payload.notification) {
             toast.info(payload.notification.title || 'New notification', {
               description: payload.notification.body
             });
           }
         });
       }
     } catch (error) {
       console.error('[Firebase] Failed to get token:', error);
       toast.error("Failed to enable notifications");
     }
   } catch (error) {
     console.error('[PushNotificationManager] Setup failed:', error);
     toast.error("Notification setup failed");
   }
  };

  const initStudentPushNotifications = async () => {
    try {
      console.log('[PushNotificationManager] Setting up student push notifications...');
      console.log('[PushInit] studentSession:', JSON.stringify(studentSession));

      if (!studentSession?.id && !studentSession?.student_id) {
        console.warn('[PushInit] No student ID found in session');
        return;
      }

      // Initialize Firebase Messaging
      const msg = await initializeFirebase();
      if (!msg) {
        toast.error("Firebase initialization failed");
        return;
      }

      // Get VAPID key
      const vapidKey = await getVapidKey();
      console.log('[VAPID] Key ready:', !!vapidKey);
      if (!vapidKey) {
        toast.error("Push notifications not configured");
        return;
      }

      // Get or create student notification preference
      // Use student_id field (e.g., "S25007") NOT the UUID id field
      const studentIdValue = studentSession.student_id;
      console.log('[PushInit] Using student_id:', studentIdValue);
      const prefs = await base44.entities.StudentNotificationPreference.filter({
        student_id: studentIdValue
      });
      let pref = prefs[0];

      if (!pref) {
        console.log('[PushNotificationManager] Creating new student notification preference');
        pref = await base44.entities.StudentNotificationPreference.create({
          student_id: studentIdValue,
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

      // Get FCM token using Firebase SDK
      try {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        console.log('[Firebase] Student requesting FCM token... iOS:', isIOS);
        
        const registration = await navigator.serviceWorker.ready;
        const token = await getToken(msg, {
          vapidKey: vapidKey,
          serviceWorkerRegistration: registration
        });

        console.log('[Firebase] Student FCM token obtained:', token?.substring(0, 20) + '...');

        if (token) {
          console.log('[Token Save] Saving token for student_id:', studentIdValue, 'token:', token?.substring(0, 20));
          await base44.entities.StudentNotificationPreference.update(pref.id, {
            browser_push_token: token
          });
          console.log('[PushNotificationManager] Student token saved to DB');
          toast.success("Student notifications enabled!");
          
          // Setup foreground message handler
          onMessage(msg, (payload) => {
            console.log('[Firebase] Student foreground message received:', payload);
            playNotificationSound();
            if (payload.notification) {
              toast.info(payload.notification.title || 'New notification', {
                description: payload.notification.body
              });
            }
          });
        }
      } catch (error) {
        console.error('[Firebase] Failed to get student token:', error);
        toast.error("Failed to enable student notifications");
      }
    } catch (error) {
      console.error('[PushNotificationManager] Student setup failed:', error);
    }
  };

  useEffect(() => {
    // Auto-run for non-iOS or if permission already granted
    console.log('[Permission]:', Notification.permission);
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

    // Listen for foreground notification messages to play sound
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'PLAY_SOUND') {
          playNotificationSound();
        }
      });
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