import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Singleton guard
let _oneSignalLoaded = false;

async function initOneSignal(externalUserId) {
  if (!externalUserId || _oneSignalLoaded) return;
  _oneSignalLoaded = true;

  try {
    const appIdRes = await fetch('/api/functions/getOneSignalAppId');
    const appIdData = await appIdRes.json();
    const appId = appIdData?.appId || appIdData?.app_id;
    if (!appId) {
      console.warn('[OneSignal] App ID not available, skipping init');
      _oneSignalLoaded = false;
      return;
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
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

      // Associate this device with the external user ID
      // This enables bulk sending via include_external_user_ids
      await OneSignal.login(externalUserId);
      console.log('[OneSignal] Initialized and logged in as:', externalUserId);
    });

    if (!document.querySelector('script[src*="OneSignalSDK"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  } catch (e) {
    console.warn('[OneSignal] Init error (non-fatal):', e.message);
    _oneSignalLoaded = false;
  }
}

export default function PushNotificationManager() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        // Determine external user ID
        let externalUserId = null;

        const studentRaw = localStorage.getItem('student_session');
        if (studentRaw) {
          const s = JSON.parse(studentRaw);
          const sid = s?.student_id || s?.id;
          if (sid) externalUserId = `student_${sid}`;
        }

        if (!externalUserId) {
          const staffRaw = localStorage.getItem('staff_session');
          if (staffRaw) {
            const s = JSON.parse(staffRaw);
            const sid = s?.staff_id || s?.username;
            if (sid) externalUserId = `staff_${sid}`;
          }
        }

        if (!externalUserId) {
          console.log('[OneSignal] No user session found, skipping push init');
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
        }

        // Init OneSignal after short delay to not block render
        setTimeout(() => initOneSignal(externalUserId), 2000);

      } catch (e) {
        console.warn('[PushNotificationManager] Error (non-fatal):', e.message);
      }
    };

    run();
  }, []);

  const handleEnableNotifications = async () => {
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setShowIOSPrompt(false);
        toast.success('Notifications enabled!');
      } else {
        toast.error('Notifications blocked. Enable in iPhone Settings.');
      }
    } catch (e) {
      toast.error('Failed to enable notifications');
    }
  };

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