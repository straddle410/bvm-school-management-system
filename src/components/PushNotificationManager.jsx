import { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function PushNotificationManager() {
  const [showPrompt, setShowPrompt] = useState(false);
  const oneSignalRef = useRef(null); // hold OneSignal instance after init
  const initDoneRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (initDoneRef.current) return;
      initDoneRef.current = true;

      console.log('[PNM] Starting push init');

      // --- Resolve session ---
      const staffRaw = localStorage.getItem('staff_session');
      const studentRaw = localStorage.getItem('student_session');

      let externalUserId = null;
      let tokenSaveFn = null;
      let tokenSavePayload = null;

      if (staffRaw) {
        const staff = JSON.parse(staffRaw);
        const staffId = staff?.staff_id;
        if (!staffId) { console.log('[PNM] No staff_id, skipping'); return; }
        externalUserId = `staff_${staffId}`;
        tokenSaveFn = 'saveStaffPushToken';
        tokenSavePayload = (pid) => ({ staff_id: staffId, player_id: pid });
        console.log('[PNM] Staff session:', externalUserId);
      } else if (studentRaw) {
        const student = JSON.parse(studentRaw);
        const studentId = student?.student_id;
        if (!studentId) { console.log('[PNM] No student_id, skipping'); return; }
        externalUserId = `student_${studentId}`;
        tokenSaveFn = 'saveStudentPushToken';
        tokenSavePayload = (pid) => ({ student_id: studentId, player_id: pid });
        console.log('[PNM] Student session:', externalUserId);
      }

      if (!externalUserId) { console.log('[PNM] No session, skipping'); return; }

      // --- iOS non-PWA: hint only ---
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;
      if (isIOS && !isPWA) {
        if (!sessionStorage.getItem('ios_push_hint_shown')) {
          sessionStorage.setItem('ios_push_hint_shown', '1');
          toast.info('To receive notifications on iPhone: Safari → Share → Add to Home Screen');
        }
        return;
      }

      // --- Permission denied: nothing we can do ---
      if (Notification.permission === 'denied') {
        console.warn('[PNM] Permission denied, skipping init');
        return;
      }

      // --- Fetch OneSignal App ID ---
      const appIdRes = await fetch('/api/functions/getOneSignalAppId');
      const appIdData = await appIdRes.json();
      const appId = appIdData?.appId || appIdData?.app_id;
      if (!appId) { console.warn('[PNM] No OneSignal App ID'); return; }

      console.log('[PNM] OneSignal App ID fetched, setting up SDK');

      // --- Token save helper ---
      let tokenSaved = false;
      const saveToken = async (playerId) => {
        if (!playerId || tokenSaved) return;
        tokenSaved = true;
        console.log('[PNM] Saving playerId:', playerId, 'via', tokenSaveFn);
        try {
          await base44.functions.invoke(tokenSaveFn, tokenSavePayload(playerId));
          console.log('[PNM] Token saved successfully');
        } catch (e) {
          console.error('[PNM] Token save error:', e);
        }
      };

      // --- Init OneSignal REGARDLESS of permission state ---
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal) {
        try {
          console.log('[PNM] OneSignal.init() starting');
          await OneSignal.init({
            appId,
            serviceWorkerPath: '/api/functions/oneSignalServiceWorker',
            serviceWorkerUpdaterPath: '/api/functions/oneSignalServiceWorker',
            serviceWorkerParam: { scope: '/' },
            autoRegister: false,
            autoResubscribe: false,
            allowLocalhostAsSecureOrigin: true,
            promptOptions: { slidedown: { enabled: false } },
            notifyButton: { enable: false },
          });
          console.log('[PNM] OneSignal.init() complete');

          // --- Debug service worker registration ---
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
              console.log('[PNM] SW ready — scope:', reg.scope, 'state:', reg.active?.state);
            });
            const swReg = await navigator.serviceWorker.getRegistration('/');
            if (swReg) {
              console.log('[PNM] SW registration found — scope:', swReg.scope, 'active:', swReg.active?.state, 'installing:', swReg.installing?.state);
            } else {
              console.warn('[PNM] No SW registration at scope "/" — attempting manual registration');
              try {
                const newReg = await navigator.serviceWorker.register('/api/functions/oneSignalServiceWorker', { scope: '/' });
                console.log('[PNM] SW manually registered — scope:', newReg.scope);
              } catch (swErr) {
                console.error('[PNM] SW manual registration failed:', swErr);
              }
            }
          }

          oneSignalRef.current = OneSignal;

          // --- Login (associates this device with external_user_id in OneSignal) ---
          // OneSignal automatically creates a separate subscription per device.
          // Do NOT logout — that would remove this device's subscription.
          const currentExtId = OneSignal.User.getExternalId?.();
          if (currentExtId !== externalUserId) {
            console.log('[PNM] OneSignal.login():', externalUserId);
            await OneSignal.login(externalUserId);
            console.log('[PNM] Login complete');
          } else {
            console.log('[PNM] Already logged in as:', externalUserId);
          }

          // --- Listen for subscription changes on this device ---
          OneSignal.User.PushSubscription.addEventListener('change', async (event) => {
            const newId = event?.current?.id;
            const isOptedIn = event?.current?.optedIn;
            console.log('[PNM] PushSubscription change — id:', newId, 'optedIn:', isOptedIn);
            if (newId && isOptedIn) {
              console.log('[PNM] New subscription created, saving playerId:', newId);
              await saveToken(newId);
            }
          });

          // --- Check this device's subscription state ---
          const sub = OneSignal.User.PushSubscription;
          const subId = sub.id;
          const subOptedIn = sub.optedIn;
          console.log('[PNM] Device subscription state — id:', subId, 'optedIn:', subOptedIn);

          if (subId && subOptedIn) {
            // Active subscription on this device — save playerId
            console.log('[PNM] Active subscription found, saving playerId:', subId);
            await saveToken(subId);
          } else if (Notification.permission === 'granted') {
            // Permission already granted but subscription inactive — activate it directly
            console.log('[PNM] Permission granted but subscription inactive, calling setActive(true)');
            try {
              await OneSignal.User.PushSubscription.setActive(true);
              // playerId will arrive via the 'change' event listener above
            } catch (e) {
              console.error('[PNM] setActive error:', e);
            }
          } else {
            // No permission yet — prompt user
            console.log('[PNM] No permission, showing prompt');
            setShowPrompt(true);
          }
        } catch (err) {
          console.error('[PNM] OneSignal error:', err.message);
        }
      });

      // Load SDK if not already loaded
      if (!document.querySelector('script[src*="OneSignalSDK"]')) {
        console.log('[PNM] Loading OneSignal SDK script');
        const script = document.createElement('script');
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
        script.defer = true;
        document.head.appendChild(script);
      }
    };

    run();
  }, []);

  const handleEnableNotifications = async () => {
    try {
      console.log('[PNM] User clicked Allow — requesting permission');
      const permission = await Notification.requestPermission();
      setShowPrompt(false);
      if (permission === 'granted') {
        console.log('[PNM] Permission granted by user');
        toast.success('Notifications enabled!');
        // OneSignal detects the permission change via PushSubscription change event
        // If playerId still not available, trigger OneSignal native prompt
        if (oneSignalRef.current) {
          try {
            await oneSignalRef.current.Notifications.requestPermission();
          } catch {}
        }
      } else {
        toast.error('Notifications blocked. Please enable from device settings.');
      }
    } catch (e) {
      toast.error('Failed to enable notifications');
    }
  };

  return (
    <>
      {showPrompt && (
        <div className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4">
          <div className="bg-white border border-blue-200 shadow-xl rounded-2xl px-4 py-3 flex items-center gap-3 max-w-sm w-full">
            <span className="text-2xl">🔔</span>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-800">Enable Notifications</p>
              <p className="text-xs text-gray-500">Get alerts for notices, homework & more</p>
            </div>
            <button
              onClick={handleEnableNotifications}
              className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold px-3 py-2 rounded-xl"
            >
              Allow
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="text-gray-400 hover:text-gray-600 text-lg leading-none"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}