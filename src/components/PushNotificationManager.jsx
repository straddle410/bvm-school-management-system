import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

let audioContext = null;

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
};

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

export default function PushNotificationManager({ studentId }) {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [studentSession, setStudentSession] = useState(null);
  const [initAttempts, setInitAttempts] = useState(0);

  // Unlock AudioContext on user gesture
  useEffect(() => {
    try {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isMobileBrowser = isMobile && !window.matchMedia('(display-mode: standalone)').matches;

      if (isMobileBrowser) {
        console.log('[Push] Mobile browser - skipping AudioContext');
        return;
      }

      const unlock = async () => {
        try {
          const ctx = getAudioContext();
          await ctx.resume();
          console.log('[Sound] AudioContext state:', ctx.state);
        } catch (e) {
          console.log('[Sound] Unlock error:', e);
        }
      };
      document.addEventListener('click', unlock, { once: true });
      document.addEventListener('touchstart', unlock, { once: true });
    } catch (e) {
      console.log('[Push] Error:', e);
    }
  }, []);

  // Play sound using AudioContext
  const playSound = async () => {
    try {
      const ctx = getAudioContext();
      await ctx.resume();
      const response = await fetch('/notification.mp3');
      const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      console.log('[Sound] Playing!');
    } catch(e) {
      console.log('[Sound] Error:', e);
    }
  };

  useEffect(() => {
    try {
      console.log('[PushInit] Mounted with:', studentId);
      console.log('[PushInit] All localStorage:', JSON.stringify(localStorage));
      console.log('[PushInit] student_id:', localStorage.getItem('student_id'));
      console.log('[PushInit] studentId:', localStorage.getItem('studentId'));
      console.log('[PushInit] student_token:', !!localStorage.getItem('student_token'));

      // Get student session if exists
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

      // Detect iOS PWA
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;

      if (isIOS && isPWA && Notification.permission === 'default') {
        setShowIOSPrompt(true);
        return;
      }
    } catch (e) {
      console.log('[Push] Error:', e);
    }
  }, []);

  const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowIOSPrompt(false);
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
      
      // Check and request permission if needed
      let permission = Notification.permission;
      console.log('[Permission] Current status:', permission);

      if (permission === 'default') {
        console.log('[Permission] Requesting user permission...');
        permission = await Notification.requestPermission();
        console.log('[Permission] User response:', permission);
      }

      if (permission === 'denied') {
        console.error('[Permission] Notifications blocked by user');
        toast.error("Notifications blocked. Enable in your browser/device settings.");
        return;
      }

      if (permission !== 'granted') {
        console.warn('[Permission] Unexpected permission state:', permission);
        return;
      }

      // Get VAPID key
      const vapidKey = await getVapidKey();
      console.log('[VAPID] Key ready:', !!vapidKey);
      if (!vapidKey) {
        toast.error("Push notifications not configured");
        return;
      }

      // Register service worker
      if ('serviceWorker' in navigator) {
        try {
          await navigator.serviceWorker.register(
            '/api/functions/firebaseMessagingServiceWorker',
            { scope: '/' }
          );
          await navigator.serviceWorker.ready;
          console.log('[ServiceWorker] Registered successfully');
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

          const token = JSON.stringify(subscription.toJSON());
          console.log('[PushNotificationManager] Token obtained:', token?.substring(0, 20) + '...');

          if (token) {
            const alreadyHadToken = !!pref.browser_push_token;
            await base44.entities.NotificationPreference.update(pref.id, {
              browser_push_token: token
            });
            console.log('[PushNotificationManager] Token saved to database');
            if (!alreadyHadToken) {
              toast.success("Notifications enabled successfully!");
            }
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
      console.log('[PushInit] studentSession:', JSON.stringify(studentSession));

      if (!studentSession?.id && !studentSession?.student_id) {
        console.warn('[PushInit] No student ID found in session');
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

      // Get push subscription token via service worker
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const applicationServerKey = urlBase64ToUint8Array(vapidKey);

          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey
          });

          const token = JSON.stringify(subscription.toJSON());
          console.log('[PushNotificationManager] Student token obtained:', token?.substring(0, 20) + '...');

          if (token) {
            const alreadyHadToken = !!pref.browser_push_token;
            console.log('[Token Save] Saving token for:', studentIdValue);
            await base44.entities.StudentNotificationPreference.update(pref.id, {
              browser_push_token: token
            });
            console.log('[PushNotificationManager] Student token saved to database');
            if (!alreadyHadToken) {
              toast.success("Student notifications enabled!");
            }
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
    try {
      console.log('[Permission]:', Notification.permission);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;

      // iOS limitation check
      if (isIOS && !isPWA) {
        if (!sessionStorage.getItem('ios_push_hint_shown')) {
          sessionStorage.setItem('ios_push_hint_shown', '1');
          toast.info("To receive notifications on iPhone: Open in Safari > Share > Add to Home Screen");
        }
        return;
      }

      // iOS PWA - wait for button click
      if (isIOS && isPWA && Notification.permission === 'default') {
        console.log('[PushNotificationManager] Waiting for iOS permission...');
        return;
      }

      // Always attempt initialization (no session block)
      console.log('[PushNotificationManager] Attempting initialization...');
      initPushNotifications();

      // Listen for foreground notification messages
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('[Notification] Foreground message received:', event.data);
          if (event.data?.type === 'PLAY_SOUND') {
            playSound();
          }
        });
      }
    } catch (e) {
      console.log('[Push] Error:', e);
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