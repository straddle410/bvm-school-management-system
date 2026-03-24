import { useEffect } from 'react';

const ONESIGNAL_APP_ID = 'f9f58c61-8668-43b1-8164-9c960b4d2500';

export default function PushNotificationManager() {
  useEffect(() => {
    if (!window.OneSignalDeferred) {
      window.OneSignalDeferred = [];
    }

    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
        });
        await OneSignal.Notifications.requestPermission();
      } catch (e) {
        console.error('[OneSignal] Init failed:', e);
      }
    });
  }, []);

  return null;
}