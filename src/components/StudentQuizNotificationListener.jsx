import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function StudentQuizNotificationListener({ studentSession }) {
  useEffect(() => {
    if (!studentSession?.student_id || !studentSession?.class_name) return;

    const loadPrefsAndSubscribe = async () => {
      try {
        // Load student notification preferences
        const prefs = await base44.entities.StudentNotificationPreference.filter({
          student_id: studentSession.student_id
        });
        const prefRecord = prefs[0];

        if (!prefRecord || !prefRecord.quiz_notifications) {
          return; // Quiz notifications disabled
        }

        // Subscribe to quiz updates
        const unsubscribe = base44.entities.Quiz.subscribe((event) => {
          if (event.type !== 'update') return;

          const quiz = event.data;
          
          // Check if quiz is for this student's class and is newly published
          if (quiz.class_name === studentSession.class_name && quiz.status === 'Published') {
            showNotification(quiz, prefRecord);
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error('Failed to setup quiz listener:', err);
      }
    };

    let unsubscribe;
    loadPrefsAndSubscribe().then(unsub => { unsubscribe = unsub; });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [studentSession?.student_id, studentSession?.class_name]);

  const showNotification = (quiz, prefs) => {
    // Show in-app toast
    toast.info(`New Quiz: ${quiz.title} - ${quiz.subject}`);

    // Play sound if enabled
    if (prefs.sound_enabled) {
      playNotificationSound(prefs.sound_volume);
    }

    // Send browser push notification if permission granted
    if (prefs.browser_push_enabled && Notification.permission === 'granted') {
      new Notification('New Quiz Posted', {
        body: `${quiz.title} (${quiz.subject})`,
        icon: '/notification-icon.png',
        badge: '/notification-badge.png',
        tag: `quiz-${quiz.id}`,
        requireInteraction: false,
        data: {
          action_url: '/Quiz',
          notificationId: quiz.id,
        },
        vibrate: [200, 100, 200],
      });
    }
  };

  const playNotificationSound = (volume) => {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.error('Failed to play sound:', err);
    }
  };

  return null;
}