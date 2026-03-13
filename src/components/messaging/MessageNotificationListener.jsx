import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { notificationService } from '@/components/notificationService';
import { toast } from 'sonner';

export default function MessageNotificationListener() {
  useEffect(() => {
    let unsubscribe;

    const setupListener = async () => {
      try {
        // CRITICAL: Students use session-only auth. Never call auth.me() for students.
        // Check student_session in BOTH localStorage AND sessionStorage
        const studentSessionLocal = localStorage.getItem('student_session');
        const studentSessionSession = sessionStorage.getItem('student_session');
        if (studentSessionLocal || studentSessionSession) return; // Students don't use this listener
        
        // Additional safety: Check URL path — if /student*, skip
        if (typeof window !== 'undefined' && window.location.pathname.startsWith('/student')) return;

        // CRITICAL: Staff use custom authentication, NOT Base44 auth
        // If staff session exists, skip this listener entirely
        const staffSession = localStorage.getItem('staff_session');
        if (staffSession) return; // Staff don't use Base44 message notifications

        // Resolve current user: ONLY use base44 auth for regular authenticated users
        let currentEmail = null;
        let currentName = null;
        const user = await base44.auth.me().catch(() => null);
        if (user?.email) { currentEmail = user.email; currentName = user.full_name; }
        if (!currentEmail) return;

        const currentUser = { email: currentEmail, full_name: currentName };

        // Subscribe to new messages for current user
        unsubscribe = base44.entities.Message.subscribe((event) => {
          if (event.type === 'create') {
            handleNewMessage(event.data, currentUser);
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
    // Only notify if message is addressed to current user (by email)
    const myEmail = currentUser.email;
    if (message.recipient_type === 'individual' && message.recipient_id !== myEmail) {
      return;
    }
    // Don't self-notify
    if (message.sender_id === myEmail) return;

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