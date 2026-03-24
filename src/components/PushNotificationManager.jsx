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

// Store resolved OneSignal instance for later use
let _oneSignalInstance = null;
let _oneSignalInitialized = false;
let _pushInitialized = false;

async function initOneSignal(userIdentifier) {
  if (typeof window === 'undefined') return;
  if (!userIdentifier) {
    console.log('[OneSignal] No user — skipping init');
    return;
  }
  if (window._oneSignalLoaded) {
    console.log('[FINAL] OneSignal already loaded → skipping');
    return;
  }
  window._oneSignalLoaded = true;

  try {
    const appIdRes = await fetch('/api/functions/getOneSignalAppId');
    const appIdData = await appIdRes.json();
    const appId = appIdData?.appId || appIdData?.app_id;
    if (!appId) {
      console.warn('[OneSignal] App ID not available, skipping init');
      window._oneSignalLoaded = false;
      return;
    }

    // STEP 1: Reset deferred array
    window.OneSignalDeferred = [];

    // STEP 2: Push config BEFORE script loads
    window.OneSignalDeferred.push(async function(OneSignal) {
      window._oneSignalInstance = OneSignal;
      _oneSignalInstance = OneSignal;
      await OneSignal.init({
        appId,
        serviceWorkerPath: '/api/functions/oneSignalServiceWorker',
        serviceWorkerUpdaterPath: '/api/functions/oneSignalServiceWorker',
        serviceWorkerParam: { scope: '/' },
        autoRegister: false,
        autoResubscribe: false,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: { enable: false },
      });
      console.log('[FINAL] OneSignal initialized correctly');
    });

    // STEP 3: Load script AFTER config is pushed
    if (!document.querySelector('script[src*="OneSignalSDK"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  } catch (e) {
    console.warn('[OneSignal] Init error (non-fatal):', e.message);
    window._oneSignalLoaded = false;
  }
}

async function getOneSignalPlayerId() {
  try {
    // OneSignal SDK v16 API: User.PushSubscription.id (getUserId removed)
    const os = _oneSignalInstance || window.OneSignal;
    if (!os) return null;
    const playerId = os.User?.PushSubscription?.id;
    console.log('[OneSignal] Player ID (v16):', playerId);
    return playerId || null;
  } catch (e) {
    console.warn('[OneSignal] getPlayerId error (non-fatal):', e.message);
    return null;
  }
}

export default function PushNotificationManager({ studentId }) {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [studentSession, setStudentSession] = useState(null);

  // Unlock AudioContext on user gesture
  useEffect(() => {
    try {
      // Check if mobile browser (not PWA)
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isMobileBrowser = isMobile && !window.matchMedia('(display-mode: standalone)').matches;

      if (isMobileBrowser) {
        console.log('[Push] Mobile browser - skipping AudioContext');
        return; // skip on mobile browser
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
      // silently fail, don't crash app
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

  // Initialize OneSignal only when user is known
  useEffect(() => {
    let studentId = null;
    const studentSessionRaw = localStorage.getItem('student_session');
    if (studentSessionRaw) {
      try {
        const parsed = JSON.parse(studentSessionRaw);
        studentId = parsed?.student_id || parsed?.id || null;
        console.log('[FINAL FIX] Student detected:', studentId);
      } catch (e) {
        console.log('[FINAL FIX] Student parse error');
      }
    }

    let staffId = null;
    const staffSessionRaw = localStorage.getItem('staff_session');
    if (staffSessionRaw) {
      try {
        const parsed = JSON.parse(staffSessionRaw);
        staffId = parsed?.staff_id || parsed?.username || null;
      } catch (e) {}
    }

    console.log('[FINAL FIX] studentId:', studentId, 'staffId:', staffId);

    if (!studentId && !staffId) {
      console.log('[FINAL FIX] No user → skip OneSignal');
      return;
    }

    setTimeout(() => {
      initOneSignal(studentId || staffId);
    }, 2000);

    console.log('[FINAL] Calling init after user ready');
    initPushNotifications();
  }, [studentSession]);

  useEffect(() => {
    // studentSession already initialized via useState from localStorage — no re-parsing needed
    // Detect iOS PWA and show prompt if needed
    try {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;
      if (isIOS && isPWA && Notification.permission === 'default') {
        setShowIOSPrompt(true);
      }
    } catch (e) {}
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
   if (_pushInitialized) return;
   _pushInitialized = true;
   try {
     console.log('[PushNotificationManager] Initializing push notifications...');
     let permission = Notification.permission;
     console.log('[Permission] Status:', permission);

     // Request permission if default
     if (permission === 'default') {
       permission = await Notification.requestPermission();
       console.log('[Permission] After request:', permission);
     }

     // Exit if denied
     if (permission === 'denied') {
       console.warn('[PushNotificationManager] Notification permission denied');
       toast.error("Enable notifications in your browser/device settings");
       return;
     }

     // Get VAPID key directly
     const vapidKey = await getVapidKey();
     console.log('[VAPID] Key ready:', !!vapidKey);
     if (!vapidKey) {
       toast.error("Push notifications not configured");
       return;
     }

     // Register service worker — same-origin URL required for Android PWA
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
     const staffRaw = localStorage.getItem('staff_session');
     const hasStaffSession = !!staffRaw;
     let user = null;
     let identifier = null;

     console.log('[PushStaff] hasStaffSession:', hasStaffSession);

     if (hasStaffSession) {
       try {
         user = JSON.parse(staffRaw);
         console.log('[PushStaff] Parsed staff_session keys:', Object.keys(user));
         console.log('[PushStaff] staff_id:', user.staff_id, '| username:', user.username, '| email:', user.email);
         identifier = user.staff_id || user.username;
         console.log('[PushStaff] Using identifier:', identifier);
       } catch (e) {
         console.error('[PushStaff] Failed to parse staff_session:', e);
       }
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

     // For staff sessions, use StaffNotificationPreference; for base44 users, use NotificationPreference
     let pref;
     if (hasStaffSession) {
       // Staff pref is managed via backend (saveStaffPushToken) - just set a placeholder to pass the push_enabled check
       pref = { browser_push_enabled: true, browser_push_token: null };
       } else {
       const prefs = await base44.entities.NotificationPreference.filter({ user_email: identifier });
       pref = prefs[0];
       if (!pref) {
         console.log('[PushNotificationManager] Creating new NotificationPreference for', identifier);
         pref = await base44.entities.NotificationPreference.create({
           user_email: identifier,
           notifications_enabled: true,
           browser_push_enabled: true,
           sound_enabled: true,
           sound_volume: 0.7,
           message_notifications: true
         });
       }
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
           if (hasStaffSession) {
             console.log('Calling saveStaffPushToken', identifier);
             await base44.functions.invoke('saveStaffPushToken', {
               staff_id: identifier,
               browser_push_token: token,
               staff_name: user?.name || user?.full_name || '',
             });
             console.log('[PushNotificationManager] Staff token saved via backend');
           } else {
             await base44.entities.NotificationPreference.update(pref.id, {
               browser_push_token: token
             });
             console.log('[PushNotificationManager] Token saved to NotificationPreference');
           }
           if (!alreadyHadToken) {
             toast.success("Notifications enabled successfully!");
           }

           // --- OneSignal: collect player_id in parallel (non-blocking) ---
           setTimeout(async () => {
             try {
               const playerId = await getOneSignalPlayerId();
               if (playerId) {
                 await base44.functions.invoke('saveOneSignalPlayerId', {
                   player_id: playerId,
                   user_type: hasStaffSession ? 'staff' : 'user',
                   identifier,
                 });
                 console.log('[OneSignal] Player ID saved for', hasStaffSession ? 'staff' : 'user', identifier);
               }
             } catch (e) {
               console.warn('[OneSignal] Failed to save player_id (non-fatal):', e.message);
             }
           }, 2000);
         }
       } catch (error) {
         console.error('[PushNotificationManager] Failed to get token:', error);
         toast.error("Failed to enable notifications");
       }
     }
   } catch (error) {
      _pushInitialized = false; // allow retry on error
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

      let permission = Notification.permission;
      console.log('[Permission] Student status:', permission);

      // Request permission if default
      if (permission === 'default') {
        permission = await Notification.requestPermission();
        console.log('[Permission] After student request:', permission);
      }

      // Exit if denied
      if (permission === 'denied') {
        console.warn('[PushNotificationManager] Student notification permission denied');
        toast.error("Enable notifications in your browser/device settings");
        return;
      }

      // Get VAPID key directly
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
            console.log('[Token Save] Saving token for:', studentIdValue, 'token:', token?.substring(0, 20));
            await base44.entities.StudentNotificationPreference.update(pref.id, {
              browser_push_token: token
            });
            console.log('[PushNotificationManager] Student token saved to DB');
            if (!alreadyHadToken) {
              toast.success("Student notifications enabled!");
            }

            // --- OneSignal: collect player_id in parallel (non-blocking) ---
            setTimeout(async () => {
              try {
                const playerId = await getOneSignalPlayerId();
                if (playerId) {
                  await base44.functions.invoke('saveOneSignalPlayerId', {
                    player_id: playerId,
                    user_type: 'student',
                    identifier: studentIdValue,
                  });
                  console.log('[OneSignal] Player ID saved for student:', studentIdValue);
                }
              } catch (e) {
                console.warn('[OneSignal] Failed to save student player_id (non-fatal):', e.message);
              }
            }, 2000);
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
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;

      if (isIOS && !isPWA) {
        if (!sessionStorage.getItem('ios_push_hint_shown')) {
          sessionStorage.setItem('ios_push_hint_shown', '1');
          toast.info("To receive notifications on iPhone: Open in Safari > Share > Add to Home Screen");
        }
        return;
      }

      if (isIOS && isPWA && Notification.permission === 'default') {
        return; // wait for button click
      }

      if (!isIOS || Notification.permission === 'granted') {
        // DO NOTHING HERE — push init is handled after user detection
      }

      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data?.type === 'PLAY_SOUND') playSound();
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