import { base44 } from '@/api/base44Client';

export const notificationService = {
  // Request permission for browser notifications
  async requestPermission() {
    if (!('Notification' in window)) {
      console.warn('Browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  },

  // Register service worker and subscribe to push notifications
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return null;
    }

    try {
      // Try to register the service worker from public directory
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('Service Worker registered');
      
      // Now subscribe to push notifications if supported
      if ('pushManager' in reg) {
        try {
          const subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: this._urlBase64ToUint8Array('AQAB') // Dummy key for testing
          });
          
          const token = JSON.stringify(subscription);
          console.log('Push subscription obtained:', token);
          return { reg, subscription, token };
        } catch (pushError) {
          console.warn('Push subscription failed (not critical):', pushError);
          return { reg, subscription: null, token: null };
        }
      }
      
      return { reg, subscription: null, token: null };
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      console.warn('Will use foreground notifications only');
      return null;
    }
  },

  // Helper to convert base64 to Uint8Array
  _urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return new Uint8Array([...rawData].map(char => char.charCodeAt(0)));
  },

  // Get notification preferences for current user
  async getPreferences() {
    try {
      // CRITICAL: Block students from calling auth.me() — return null immediately
      const studentSessionLocal = localStorage.getItem('student_session');
      const studentSessionSession = sessionStorage.getItem('student_session');
      if (studentSessionLocal || studentSessionSession) {
        console.warn('[notificationService] Student session detected. Blocking auth.me() call in getPreferences().');
        return null;
      }

      // Check for staff session first
      const staffSession = localStorage.getItem('staff_session');
      const staffData = staffSession ? JSON.parse(staffSession) : null;
      
      let userEmail = staffData?.email;
      
      // If no staff session, try regular auth (staff/admin only)
      if (!userEmail) {
        const user = await base44.auth.me();
        if (!user) {
          console.error('No user authenticated');
          return null;
        }
        userEmail = user.email;
      }

      console.log('Getting preferences for user:', userEmail);
      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: userEmail,
      });

      if (prefs && prefs.length > 0) {
        console.log('Loaded preferences from DB:', prefs[0]);
        return prefs[0];
      }
      console.log('No preferences found in DB for:', userEmail);
      return null;
    } catch (error) {
      console.error('Failed to fetch preferences:', error.message, error);
      throw error;
    }
  },

  // Save/update notification preferences
  async savePreferences(preferences) {
    try {
      // CRITICAL: Block students from calling auth.me() — return null immediately
      const studentSessionLocal = localStorage.getItem('student_session');
      const studentSessionSession = sessionStorage.getItem('student_session');
      if (studentSessionLocal || studentSessionSession) {
        console.warn('[notificationService] Student session detected. Blocking auth.me() call in savePreferences().');
        return null;
      }

      // Check for staff session first
      const staffSession = localStorage.getItem('staff_session');
      const staffData = staffSession ? JSON.parse(staffSession) : null;
      
      let userEmail = staffData?.email;
      
      // If no staff session, try regular auth (staff/admin only)
      if (!userEmail) {
        const user = await base44.auth.me();
        if (!user) return null;
        userEmail = user.email;
      }

      const existing = await this.getPreferences();

      if (existing) {
        // Update existing preferences
        console.log('Updating existing preference:', existing.id);
        await base44.entities.NotificationPreference.update(
          existing.id,
          { ...preferences }
        );
        // Immediately refetch to verify persistence
        const updated = await base44.entities.NotificationPreference.filter({
          user_email: userEmail,
        });
        console.log('Updated preferences:', updated[0]);
        return updated[0] || null;
      } else {
        // Create new preferences
        console.log('Creating new preference for:', userEmail);
        const created = await base44.entities.NotificationPreference.create({
          user_email: userEmail,
          ...preferences,
        });
        console.log('Created preference:', created);
        return created;
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  },

  // Show local notification
  showNotification(title, options = {}) {
    if (Notification.permission === 'granted') {
      const notification = new Notification(title, {
        icon: '/notification-icon.png',
        badge: '/notification-badge.png',
        ...options,
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      return notification;
    }
  },

  // Play notification sound
  async playSound(volume = 0.7) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gain.gain.setValueAtTime(volume, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Failed to play sound:', error);
    }
  },
};