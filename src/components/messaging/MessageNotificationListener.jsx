import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { notificationService } from '@/components/notificationService';
import { toast } from 'sonner';

export default function MessageNotificationListener() {
  useEffect(() => {
    let unsubscribe;

    const setupListener = async () => {
      try {
        const user = await base44.auth.me();
        if (!user) return;

        // Subscribe to new messages for current user
        unsubscribe = base44.entities.Message.subscribe((event) => {
          if (event.type === 'create') {
            handleNewMessage(event.data, user);
          }
        });
      } catch (error) {
        console.error('Failed to setup message listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleNewMessage = async (message, currentUser) => {
    // Only notify if message is for current user
    if (
      message.recipient_id !== currentUser.email &&
      message.recipient_id !== currentUser.id &&
      message.recipient_type === 'individual'
    ) {
      return;
    }

    // Get user's notification preferences
    const prefs = await notificationService.getPreferences();

    if (!prefs || !prefs.message_notifications) {
      return;
    }

    // Show browser notification
    if (prefs.browser_push_enabled && Notification.permission === 'granted') {
      notificationService.showNotification(
        `New message from ${message.sender_name}`,
        {
          body: message.subject || message.body.substring(0, 50),
          tag: `message-${message.id}`,
        }
      );
    }

    // Play sound
    if (prefs.sound_enabled) {
      await notificationService.playSound(prefs.sound_volume);
    }

    // Show toast (in-app notification)
    toast.info(`${message.sender_name}: ${message.subject || 'New message'}`, {
      position: 'top-right',
      duration: 5000,
    });
  };

  return null; // This is a listener-only component
}