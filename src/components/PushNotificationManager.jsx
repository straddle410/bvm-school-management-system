import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Singleton guards
let _oneSignalLoaded = false;
let _oneSignalInstance = null;

async function initOneSignal(userIdentifier) {
  if (!userIdentifier || _oneSignalLoaded) return;
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
      _oneSignalInstance = OneSignal;
      window._oneSignalInstance = OneSignal;
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
      console.log('[OneSignal] Initialized for user:', userIdentifier);
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

async function getOneSignalPlayerId() {
  try {
    const os = _oneSignalInstance || window._oneSignalInstance || window.OneSignal;
    if (!os) return null;
    const playerId = os.User?.PushSubscription?.id;
    console.log('[OneSignal] Player ID:', playerId);
    return playerId || null;
  } catch (e) {
    console.warn('[OneSignal] getPlayerId error:', e.message);
    return null;
  }
}

async function savePlayerIdForUser(userType, identifier) {
  try {
    const playerId = await getOneSignalPlayerId();
    if (!playerId) return;
    await base44.functions.invoke('saveOneSignalPlayerId', {
      player_id: playerId,
      user_type: userType,
      identifier,
    });
    console.log('[OneSignal] Player ID saved for', userType, identifier);
  } catch (e) {
    console.warn('[OneSignal] Failed to save player_id (non-fatal):', e.message);
  }
}

export default function PushNotificationManager() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

  useEffect(() => {
    const run = async () => {
      try {
        // Determine user identity
        let userType = null;
        let identifier = null;

        const studentRaw = localStorage.getItem('student_session');
        if (studentRaw) {
          const s = JSON.parse(studentRaw);
          identifier = s?.student_id || s?.id;
          userType = 'student';
        }

        if (!identifier) {
          const staffRaw = localStorage.getItem('staff_session');
          if (staffRaw) {
            const s = JSON.parse(staffRaw);
            identifier = s?.staff_id || s?.username;
            userType = 'staff';
          }
        }

        if (!identifier) {
          console.log('[OneSignal] No user session found, skipping push init');
          return;
        }

        // iOS PWA prompt
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
        setTimeout(() => initOneSignal(identifier), 2000);

        // Save player ID after OneSignal has time to initialize
        setTimeout(() => savePlayerIdForUser(userType, identifier), 6000);

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