import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function StudentMessageNotificationListener({ studentSession }) {
  useEffect(() => {
    if (!studentSession?.student_id) return;

    const loadPrefsAndSubscribe = async () => {
      try {
        // Load student notification preferences
        const prefs = await base44.entities.StudentNotificationPreference.filter({
          student_id: studentSession.student_id
        });
        const prefRecord = prefs[0];

        if (!prefRecord || !prefRecord.notifications_enabled || !prefRecord.message_notifications) {
          return; // Notifications disabled
        }

        // Subscribe to class messages
        const unsubscribe = base44.entities.Message.subscribe((event) => {
          if (event.type !== 'create') return;

          const msg = event.data;

          // Direct message to this student
          if (msg.recipient_type === 'individual' && msg.recipient_id === studentSession.student_id) {
            showNotification(msg, prefRecord);
          }
          // Class-wide broadcast
          else if (msg.recipient_type === 'class' && msg.recipient_class === studentSession.class_name) {
            showNotification(msg, prefRecord);
          }
          // Section-specific broadcast
          else if (msg.recipient_type === 'section' &&
                   msg.recipient_class === studentSession.class_name &&
                   msg.recipient_section === studentSession.section) {
            showNotification(msg, prefRecord);
          }
        });

        return unsubscribe;
      } catch (err) {
        console.error('Failed to setup message listener:', err);
      }
    };

    let unsubscribe;
    loadPrefsAndSubscribe().then(unsub => { unsubscribe = unsub; });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [studentSession?.student_id]);

  const showNotification = (msg, prefs) => {
    // Show in-app toast
    toast.info(`New message from ${msg.sender_name}: ${msg.subject || msg.body.substring(0, 50)}`);

    // Play sound if enabled
    if (prefs.sound_enabled) {
      playNotificationSound(prefs.sound_volume);
    }

    // Send browser push notification if permission granted
    if (prefs.browser_push_enabled && Notification.permission === 'granted') {
      new Notification(`Message from ${msg.sender_name}`, {
        body: msg.subject || msg.body.substring(0, 100),
        icon: '/notification-icon.png',
        badge: '/notification-badge.png',
        tag: `message-${msg.id}`,
        requireInteraction: false,
        data: {
          action_url: '/StudentMessaging',
          notificationId: msg.id,
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
      
      oscillator.frequency.value = 800;
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