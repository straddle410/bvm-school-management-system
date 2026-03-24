import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const ONESIGNAL_APP_ID = 'f9f58c61-8668-43b1-8164-9c960b4d2500';

export default function PushNotificationManager() {
  useEffect(() => {
    initOneSignal();
  }, []);

  const initOneSignal = async () => {
    try {
      if (!window.OneSignalDeferred) {
        window.OneSignalDeferred = [];
      }

      window.OneSignalDeferred.push(async (OneSignal) => {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          notifyButton: { enable: false },
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/api/functions/onesignalServiceWorker',
          serviceWorkerParam: { scope: '/' },
        });

        await OneSignal.Notifications.requestPermission();

        const playerId = await OneSignal.User.PushSubscription.id;
        if (!playerId) return;

        await savePlayerId(playerId);
      });
    } catch (e) {
      console.error('[OneSignal] Init failed:', e);
    }
  };

  const savePlayerId = async (playerId) => {
    try {
      // Check for student session first
      const studentSessionRaw = localStorage.getItem('student_session');
      if (studentSessionRaw) {
        const studentSession = JSON.parse(studentSessionRaw);
        const studentId = studentSession?.student_id;
        if (!studentId) return;

        const prefs = await base44.entities.StudentNotificationPreference.filter({ student_id: studentId });
        if (prefs[0]) {
          await base44.entities.StudentNotificationPreference.update(prefs[0].id, { browser_push_token: playerId });
        } else {
          await base44.entities.StudentNotificationPreference.create({
            student_id: studentId,
            notifications_enabled: true,
            browser_push_enabled: true,
            browser_push_token: playerId,
          });
        }
        console.log('[OneSignal] Student Player ID saved:', playerId);
        return;
      }

      // Staff session
      const staffSessionRaw = localStorage.getItem('staff_session');
      let userEmail = null;

      if (staffSessionRaw) {
        const staffSession = JSON.parse(staffSessionRaw);
        userEmail = staffSession?.email || staffSession?.username;
      } else {
        const user = await base44.auth.me().catch(() => null);
        userEmail = user?.email;
      }

      if (!userEmail) return;

      const prefs = await base44.entities.NotificationPreference.filter({ user_email: userEmail });
      if (prefs[0]) {
        await base44.entities.NotificationPreference.update(prefs[0].id, { browser_push_token: playerId });
      } else {
        await base44.entities.NotificationPreference.create({
          user_email: userEmail,
          notifications_enabled: true,
          browser_push_enabled: true,
          browser_push_token: playerId,
        });
      }
      console.log('[OneSignal] Staff Player ID saved:', playerId);
    } catch (e) {
      console.error('[OneSignal] Failed to save Player ID:', e);
    }
  };

  return null;
}