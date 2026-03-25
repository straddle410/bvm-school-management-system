import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function PushNotificationManager() {
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);

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
        const result = await Notification.requestPermission();
        if (result !== 'granted') {
          console.warn('[PushNotificationManager] Permission not granted:', result);
          return;
        }
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
            autoRegister: false,
            autoResubscribe: false,
            allowLocalhostAsSecureOrigin: true,
            promptOptions: { slidedown: { enabled: false } },
            notifyButton: { enable: false },
          });

          console.log('[PushNotificationManager] OneSignal init done, logging in:', externalUserId);
          await OneSignal.login(externalUserId);
          console.log('[PushNotificationManager] OneSignal login done');

          setTimeout(async () => {
            try {
              const playerId = OneSignal.User.PushSubscription.id;
              console.log(`${tokenSaveFn} playerId:`, playerId);

              if (!playerId) {
                console.warn('playerId not ready');
                return;
              }

              await base44.functions.invoke(tokenSaveFn, tokenSavePayload(playerId));
              console.log(`${tokenSaveFn} called successfully`);
            } catch (e) {
              console.error('Push save error:', e);
            }
          }, 4000);
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