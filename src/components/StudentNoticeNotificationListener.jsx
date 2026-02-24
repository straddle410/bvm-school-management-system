import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function StudentNoticeNotificationListener({ studentSession }) {
  useEffect(() => {
    if (!studentSession?.student_id) return;

    let prefs = null;

    const loadPrefsAndSubscribe = async () => {
      try {
        // Load notification preferences
        const prefRecords = await base44.entities.StudentNotificationPreference.filter({
          student_id: studentSession.student_id,
        });
        prefs = prefRecords.length > 0 ? prefRecords[0] : null;

        // Subscribe to notifications
        const unsubscribe = base44.entities.Notification.subscribe((event) => {
          if (event.type !== 'create') return;
          if (event.data.type !== 'notice_posted') return;
          if (event.data.recipient_student_id !== studentSession.student_id) return;

          // Check if notifications are enabled
          if (!prefs?.notifications_enabled) return;

          // Show toast
          toast.info(event.data.title, { description: event.data.message });

          // Play sound if enabled
          if (prefs.sound_enabled) {
            playNotificationSound(prefs.sound_volume);
          }

          // Send browser push if enabled
          if (prefs.browser_push_enabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(event.data.title, {
              body: event.data.message,
              icon: '/logo.png',
            });
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error('Notice notification listener error:', err);
      }
    };

    let unsubscribe;
    loadPrefsAndSubscribe().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [studentSession?.student_id]);

  return null;
}

function playNotificationSound(volume = 0.7) {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch {}
}