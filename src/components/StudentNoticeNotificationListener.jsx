import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function StudentNoticeNotificationListener({ studentSession }) {
  useEffect(() => {
    if (!studentSession?.student_id) return;

    let unsubscribe;

    const setup = async () => {
      try {
        // Load notification preferences
        const prefRecords = await base44.entities.StudentNotificationPreference.filter({
          student_id: studentSession.student_id,
        });
        const prefs = prefRecords.length > 0 ? prefRecords[0] : { notifications_enabled: true, sound_enabled: true };

        // Subscribe to all new notifications
        unsubscribe = base44.entities.Notification.subscribe((event) => {
          // Only handle create events
          if (event.type !== 'create') return;
          
          // Only handle notice_posted type
          if (event.data?.type !== 'notice_posted') return;
          
          // Only handle notifications for this student
          if (event.data?.recipient_student_id !== studentSession.student_id) return;



          console.log('Notice notification received:', event.data.title);

          // Show toast
          toast.info(event.data.title, { description: event.data.message });

          // Play sound if enabled
          if (prefs?.sound_enabled) {
            playNotificationSound(prefs?.sound_volume || 0.7);
          }

          // Send browser push if enabled
           if (prefs?.browser_push_enabled && 'Notification' in window && Notification.permission === 'granted') {
             new Notification(event.data.title, {
               body: event.data.message,
               icon: '/logo.png',
               data: {
                 action_url: '/Notices',
               },
             });
           }
        });
      } catch (err) {
        console.error('Notice listener setup error:', err);
      }
    };

    setup();

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