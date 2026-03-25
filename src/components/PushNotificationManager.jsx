import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

// Singleton guard + permission state tracking
let _oneSignalLoaded = false;
let _permissionDenied = false;
let _externalUserIdRegistered = null;

async function initOneSignal(externalUserId, staffId) {
  if (!externalUserId || _oneSignalLoaded || _permissionDenied) return;
  if (_externalUserIdRegistered === externalUserId) return;

  _oneSignalLoaded = true;

  try {
    const permission = Notification.permission;
    if (permission === 'default') {
      console.log('[OneSignal] Requesting notification permission...');
      const result = await Notification.requestPermission();
      if (result === 'denied') {
        console.warn('[OneSignal] Permission denied, skipping subscription');
        _permissionDenied = true;
        _oneSignalLoaded = false;
        return;
      }
    } else if (permission === 'denied') {
      console.warn('[OneSignal] Permission previously denied, skipping');
      _permissionDenied = true;
      _oneSignalLoaded = false;
      return;
    }
    console.log('[OneSignal] Permission granted, initializing SDK...');
  } catch (permErr) {
    console.warn('[OneSignal] Permission request error:', permErr.message);
    _oneSignalLoaded = false;
    return;
  }

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
      try {
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

        try {
          await OneSignal.login(externalUserId);
          _externalUserIdRegistered = externalUserId;
          console.log('[OneSignal] Successfully logged in as:', externalUserId);

          setTimeout(async () => {
            try {
              const playerId = OneSignal.User.PushSubscription.id;
              console.log('playerId:', playerId);
              if (!playerId) {
                console.warn('playerId not ready');
                return;
              }
              await base44.functions.invoke('saveStaffPushToken', {
                staff_id: staffId,
                player_id: playerId,
              });
              console.log('saveStaffPushToken called');
            } catch (e) {
              console.error('Push save error:', e);
            }
          }, 3000);
        } catch (loginErr) {
          console.error('[OneSignal] Login failed:', loginErr.message);
        }
      } catch (initErr) {
        console.error('[OneSignal] SDK init error:', initErr.message);
        _oneSignalLoaded = false;
      }
    });

    if (!document.querySelector('script[src*="OneSignalSDK"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }
  } catch (e) {
    console.error('[OneSignal] Init error:', e.message);
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
            // CRITICAL: Use staff_id (UUID from StaffAccount.id), NOT username or staff_code
            const sid = s?.staff_id;
            if (sid) {
              externalUserId = `staff_${sid}`;
              console.log('[PushNotificationManager] Staff push registration: staff_id=', sid, 'externalUserId=', externalUserId);
            } else {
              console.warn('[PushNotificationManager] staff_session missing staff_id (expected UUID)');
            }
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
        const rawStaff = localStorage.getItem('staff_session');
        const staffId = rawStaff ? JSON.parse(rawStaff)?.id : null;
        setTimeout(() => initOneSignal(externalUserId, staffId), 2000);

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