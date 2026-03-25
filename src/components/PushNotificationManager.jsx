import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function PushNotificationManager() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [showAndroidPrompt, setShowAndroidPrompt] = useState(false);
  const [pendingInit, setPendingInit] = useState(false);

  useEffect(() => {
    const run = async () => {
      console.log('[PushNotificationManager] mounted');

      const studentRaw = localStorage.getItem('student_session');
      if (!studentRaw) {
        console.log('[PushNotificationManager] No student session found');
        return;
      }

      try {
        const student = JSON.parse(studentRaw);
        const studentId = student?.student_id;
        if (!studentId) {
          console.log('[PushNotificationManager] Student session found but no student_id');
          return;
        }

        const externalUserId = `student_${studentId}`;
        const tokenSaveFn = 'saveStudentPushToken';
        const tokenSavePayload = (playerId) => ({ student_id: studentId, player_id: playerId });
        console.log('[PushNotificationManager] Student session detected:', externalUserId);

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

        // Check notification permission
        const permission = Notification.permission;
        if (permission === 'denied') {
          console.warn('[PushNotificationManager] Notification permission denied');
          return;
        }
        if (permission === 'default') {
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

        // Load OneSignal SDK
        if (!document.querySelector('script[src*="OneSignalSDK"]')) {
          const script = document.createElement('script');
          script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
          script.defer = true;
          document.head.appendChild(script);
        }

        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (OneSignal) {
          try {
            await OneSignal.init({
              appId,
              serviceWorkerParam: { scope: '/' },
              autoRegister: false,
              autoResubscribe: false,
              allowLocalhostAsSecureOrigin: true,
              promptOptions: { slidedown: { enabled: false } },
              notifyButton: { enable: false },
            });

            console.log('[PushNotificationManager] OneSignal init done, logging in:', externalUserId);
            await OneSignal.login(externalUserId);
            console.log('[PushNotificationManager] OneSignal login done');

            try {
              await OneSignal.User.PushSubscription.optIn();
              console.log('[PushNotificationManager] PushSubscription optIn done');
            } catch (optInErr) {
              console.warn('[PushNotificationManager] optIn error:', optInErr.message);
            }

            let attempts = 0;
            const maxAttempts = 20;

            const waitForSubscription = setInterval(async () => {
              attempts++;
              const id = OneSignal.User.PushSubscription.id;
              console.log(`[PushNotificationManager] Attempt ${attempts}: id=${id}`);

              if (id && typeof id === 'string' && id.length > 0) {
                clearInterval(waitForSubscription);
                console.log(`${tokenSaveFn} playerId ready:`, id);

                try {
                  await base44.functions.invoke(tokenSaveFn, tokenSavePayload(id));
                  console.log(`${tokenSaveFn} called successfully with playerId:`, id);
                } catch (e) {
                  console.error('Push save error:', e);
                }
              } else if (attempts >= maxAttempts) {
                clearInterval(waitForSubscription);
                console.warn('[PushNotificationManager] Subscription not ready after 10s, giving up');
              }
            }, 500);
          } catch (err) {
            console.error('[PushNotificationManager] OneSignal error:', err.message);
          }
        });
      } catch (e) {
        console.error('[PushNotificationManager] Error parsing student session:', e);
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
        if (pendingInit) {
          setPendingInit(false);
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