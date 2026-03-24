import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function OneSignalTokenSync() {
  useEffect(() => {
    syncToken();
  }, []);

  const syncToken = async () => {
    try {
      if (!window.OneSignalDeferred) return;

      window.OneSignalDeferred.push(async (OneSignal) => {
        const playerId = await OneSignal.User.PushSubscription.id;
        if (!playerId) return;

        // Determine student_id or staff email
        const studentSessionRaw = localStorage.getItem('student_session');
        if (studentSessionRaw) {
          const session = JSON.parse(studentSessionRaw);
          const student_id = session?.student_id;
          if (!student_id) return;
          await base44.functions.invoke('saveStudentPushToken', { student_id, player_id: playerId });
          console.log('[OneSignal] Student token synced:', playerId);
        } else {
          // Staff — save to NotificationPreference
          let userEmail = null;
          const staffRaw = localStorage.getItem('staff_session');
          if (staffRaw) {
            const staffSession = JSON.parse(staffRaw);
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
          console.log('[OneSignal] Staff token synced:', playerId);
        }
      });
    } catch (e) {
      console.error('[OneSignal] Token sync failed:', e);
    }
  };

  return null;
}