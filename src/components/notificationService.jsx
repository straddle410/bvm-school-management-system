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
      const user = await base44.auth.me();
      if (!user) return null;

      // Fetch with explicit force-refresh
      const prefs = await base44.entities.NotificationPreference.filter({
        user_email: user.email,
      });

      if (prefs && prefs.length > 0) {
        console.log('Loaded preferences:', prefs[0]);
        return prefs[0];
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
      return null;
    }
  },

  // Save/update notification preferences
  async savePreferences(preferences) {
    try {
      const user = await base44.auth.me();
      if (!user) return null;

      const existing = await this.getPreferences();

      if (existing) {
        // Update existing preferences
        await base44.entities.NotificationPreference.update(
          existing.id,
          { ...preferences }
        );
        // Immediately refetch to verify persistence
        const updated = await base44.entities.NotificationPreference.filter({
          user_email: user.email,
        });
        return updated[0] || null;
      } else {
        // Create new preferences
        const created = await base44.entities.NotificationPreference.create({
          user_email: user.email,
          ...preferences,
        });
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