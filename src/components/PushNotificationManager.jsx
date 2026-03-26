import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function PushNotificationManager() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [pendingInit, setPendingInit] = useState(false);

  useEffect(() => {
    const run = async () => {
      console.log('[PushNotificationManager] mounted');

      // Detect session type — staff takes priority, then student
      const staffRaw = localStorage.getItem('staff_session');
      const studentRaw = localStorage.getItem('student_session');

      let externalUserId = null;
      let tokenSaveFn = null;
      let tokenSavePayload = null;

      if (staffRaw) {
        const staff = JSON.parse(staffRaw);
        const staffId = staff?.staff_id;
        if (!staffId) return;
        externalUserId = `staff_${staffId}`;
        tokenSaveFn = 'saveStaffPushToken';
        tokenSavePayload = (playerId) => ({ staff_id: staffId, player_id: playerId });
        console.log('[PushNotificationManager] Staff session detected:', externalUserId);
        // Staff takes priority — do not fall through to student
      }

      if (!externalUserId && studentRaw) {
        const student = JSON.parse(studentRaw);
        const studentId = student?.student_id;
        if (!studentId) {
          console.log('[PushNotificationManager] Student session found but no student_id, skipping');
          return;
        }
        externalUserId = `student_${studentId}`;
        tokenSaveFn = 'saveStudentPushToken';
        tokenSavePayload = (playerId) => ({ student_id: studentId, player_id: playerId });
        console.log('[PushNotificationManager] Student session detected:', externalUserId);
      }

      if (!externalUserId) {
        console.log('[PushNotificationManager] No session found, skipping');
        return;
      }

      // iOS PWA check
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;
      if (isIOS && !isPWA) {
        if (!sessionStorage.getItem('ios_push_hint_shown')) {
          sessionStorage.setItem('ios_push_hint_shown', '1');
          toast.info('To receive notifications on iPhone: Safari → Share → Add to Home Screen');
        }
        return;
      }
      if (isIOS && isPWA && Notification.permission === 'default') {
        setShowIOSPrompt(true);
        return;
      }

      // Check/request notification permission
      const permission = Notification.permission;
      if (permission === 'denied') {
        console.warn('[PushNotificationManager] Notification permission denied');
        return;
      }
      if (permission === 'default') {
        // Android requires permission request via user gesture — show a banner
        setPendingInit(true);
        setShowAndroidPrompt(true);
        return;
      }

      // Fetch OneSignal App ID
      const appIdRes = await fetch('/api/functions/getOneSignalAppId');
      const appIdData = await appIdRes.json();
      const appId = appIdData?.appId || appIdData?.app_id;
      if (!appId) {
        console.warn('[PushNotificationManager] OneSignal App ID not available');
        return;
      }

      // Load OneSignal SDK and init
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      window.OneSignalDeferred.push(async function (OneSignal) {
        try {
          await OneSignal.init({
            appId,
            serviceWorkerPath: '/api/functions/oneSignalServiceWorker',
            serviceWorkerUpdaterPath: '/api/functions/oneSignalServiceWorker',
            serviceWorkerParam: { scope: '/' },
            autoRegister: true,
            autoResubscribe: true,
            allowLocalhostAsSecureOrigin: true,
            promptOptions: { slidedown: { enabled: false } },
            notifyButton: { enable: false },
          });

          // Request permission BEFORE login so subscription is created
          if (Notification.permission === 'default') {
            console.log('[PushNotificationManager] Requesting notification permission...');
            await OneSignal.Notifications.requestPermission();
            console.log('[PushNotificationManager] Permission result:', Notification.permission);
          }

          if (Notification.permission !== 'granted') {
            console.warn('[PushNotificationManager] Permission not granted, skipping login');
            return;
          }

          console.log('[PushNotificationManager] Logging in:', externalUserId);
          await OneSignal.login(externalUserId);
          console.log('[PushNotificationManager] OneSignal login done');

          let tokenSaved = false;

          // 1. Listen for subscription changes (handles async registration)
          OneSignal.User.PushSubscription.addEventListener('change', async (event) => {
            const playerId = event.current.id;
            if (playerId && OneSignal.User.PushSubscription.optedIn && !tokenSaved) {
              tokenSaved = true;
              console.log('[PNM] Saving playerId from change event:', playerId);
              await base44.functions.invoke(tokenSaveFn, tokenSavePayload(playerId));
            }
          });

          // 2. Check initial state (handles already-subscribed devices)
          const existingId = OneSignal.User.PushSubscription.id;
          if (existingId && OneSignal.User.PushSubscription.optedIn && !tokenSaved) {
            tokenSaved = true;
            console.log('[PNM] Saving playerId from initial check:', existingId);
            await base44.functions.invoke(tokenSaveFn, tokenSavePayload(existingId));
          }
        } catch (err) {
          console.error('[PushNotificationManager] OneSignal error:', err.message);
        }
      });

      if (!document.querySelector('script[src*="OneSignalSDK"]')) {
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
      const permission = await Notification.requestPermission();
      setShowIOSPrompt(false);
      setShowAndroidPrompt(false);
      if (permission === 'granted') {
        toast.success('Notifications enabled!');
        // If we had a pending init, re-trigger it now that permission is granted
        if (pendingInit) {
          setPendingInit(false);
          // Re-run the init by reloading OneSignal setup
          window.location.reload();
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
      {(showIOSPrompt || showAndroidPrompt) && (
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
              onClick={() => { setShowIOSPrompt(false); setShowAndroidPrompt(false); }}
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