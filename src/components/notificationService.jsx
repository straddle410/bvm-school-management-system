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

  // Register service worker for background notifications
  async registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers not supported');
      return null;
    }

    try {
      // Try to register the service worker from functions
      const reg = await navigator.serviceWorker.register(
        new URL('/functions/swWorker.js', import.meta.url),
        { scope: '/' }
      );
      console.log('Service Worker registered');
      return reg;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      // Fall back to simple notification support without service worker
      console.warn('Will use foreground notifications only');
      return null;
    }
  },

  // Get notification preferences for current user
  async getPreferences() {
    try {
      // Check for staff session first
      const staffSession = localStorage.getItem('staff_session');
      const staffData = staffSession ? JSON.parse(staffSession) : null;
      
      let userEmail = staffData?.email;
      
      // If no staff session, try regular auth
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
      // Check for staff session first
      const staffSession = localStorage.getItem('staff_session');
      const staffData = staffSession ? JSON.parse(staffSession) : null;
      
      let userEmail = staffData?.email;
      
      // If no staff session, try regular auth
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