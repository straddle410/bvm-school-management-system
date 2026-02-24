import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Volume2, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

export default function StudentNotificationSettings({ studentId }) {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');

  useEffect(() => {
    loadPreferences();
    checkPushPermission();
  }, [studentId]);

  const loadPreferences = async () => {
    try {
      const records = await base44.entities.StudentNotificationPreference.filter({ student_id: studentId });
      if (records.length > 0) {
        setPrefs(records[0]);
      } else {
        // Create default preferences
        const newPrefs = {
          student_id: studentId,
          notifications_enabled: true,
          message_notifications: true,
          quiz_notifications: true,
          sound_enabled: true,
          sound_volume: 0.7,
          browser_push_enabled: false, // Default to false, user must explicitly enable
        };
        const created = await base44.entities.StudentNotificationPreference.create(newPrefs);
        setPrefs(created);
      }
    } catch (err) {
      console.error('Failed to load preferences:', err);
      setPrefs({
        student_id: studentId,
        notifications_enabled: true,
        message_notifications: true,
        quiz_notifications: true,
        sound_enabled: true,
        sound_volume: 0.7,
        browser_push_enabled: false,
      });
    }
    setLoading(false);
  };

  const checkPushPermission = () => {
    if ('Notification' in window) {
      setPushPermission(Notification.permission);
    }
  };

  const handleRequestPushPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      toast.success('Notification permission already granted');
      return;
    }

    const permission = await Notification.requestPermission();
    setPushPermission(permission);

    if (permission === 'granted') {
      await registerServiceWorker();
      toast.success('Notifications enabled successfully');
    } else {
      toast.error('Notification permission denied');
    }
  };

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        // Register service worker for background notifications
        const reg = await navigator.serviceWorker.register('/functions/swWorkerScript.js', { 
          scope: '/' 
        });
        console.log('Service Worker registered successfully');
        
        // Store preference immediately
        if (prefs && prefs.id) {
          await handleUpdatePreference({ browser_push_enabled: true });
        }
      } catch (err) {
        console.warn('Service Worker registration fallback:', err);
        // Still allow notifications to work in foreground
        await handleUpdatePreference({ browser_push_enabled: true });
      }
    }
  };

  const handleUpdatePreference = async (updates) => {
    setSaving(true);
    try {
      const updated = { ...prefs, ...updates };
      if (prefs.id) {
        // Explicitly update in database to ensure persistence
        await base44.entities.StudentNotificationPreference.update(prefs.id, updates);
        // Reload to verify persistence
        const refreshed = await base44.entities.StudentNotificationPreference.filter({ student_id: studentId });
        if (refreshed.length > 0) {
          setPrefs(refreshed[0]);
        }
      } else {
        const created = await base44.entities.StudentNotificationPreference.create(updated);
        setPrefs(created);
      }
      toast.success('Preferences saved');
    } catch (err) {
      toast.error('Failed to save preferences');
      console.error(err);
    }
    setSaving(false);
  };

  const playTestSound = () => {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(prefs.sound_volume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  };

  if (loading || !prefs) {
    return <div className="text-gray-400 text-sm">Loading notification settings...</div>;
  }

  const renderToggleRow = (label, description, checked, onChange, showFlexShrink = false) => (
    <div className={`flex items-center justify-between gap-3 py-3 px-0 border-b border-gray-100 last:border-0 ${showFlexShrink ? 'flex-wrap' : ''}`}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <div className="flex-shrink-0">
        <Switch checked={checked} onCheckedChange={onChange} disabled={saving} />
      </div>
    </div>
  );

  return (
    <Card className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
      <CardHeader className="border-0 p-0 mb-4">
        <CardTitle className="font-bold text-gray-800 flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" /> Notifications
        </CardTitle>
        <CardDescription className="text-xs">Manage how you receive notifications</CardDescription>
      </CardHeader>

      <CardContent className="space-y-0 p-0">
        {/* Master Enable/Disable */}
        {renderToggleRow(
          'All Notifications',
          'Enable or disable all notifications',
          prefs.notifications_enabled,
          (val) => handleUpdatePreference({ notifications_enabled: val })
        )}

        {prefs.notifications_enabled && (
          <>
            {/* Message Notifications */}
            {renderToggleRow(
              'Class Messages',
              'Get notified of new class messages',
              prefs.message_notifications,
              (val) => handleUpdatePreference({ message_notifications: val })
            )}

            {/* Quiz Notifications */}
            {renderToggleRow(
              'Quiz Alerts',
              'Get notified when quizzes are posted',
              prefs.quiz_notifications,
              (val) => handleUpdatePreference({ quiz_notifications: val })
            )}

            {/* Sound Settings */}
            <div className="py-3 px-0 border-b border-gray-100">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800">Notification Sound</p>
                </div>
                <div className="flex-shrink-0">
                  <Switch
                    checked={prefs.sound_enabled}
                    onCheckedChange={(val) =>
                      handleUpdatePreference({ sound_enabled: val })
                    }
                    disabled={saving}
                  />
                </div>
              </div>
              {prefs.sound_enabled && (
                <div className="space-y-2 mt-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Slider
                        value={[prefs.sound_volume]}
                        onValueChange={(val) =>
                          handleUpdatePreference({ sound_volume: val[0] })
                        }
                        min={0}
                        max={1}
                        step={0.1}
                        disabled={saving}
                      />
                    </div>
                    <button
                      onClick={playTestSound}
                      className="flex-shrink-0 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-2 py-1 rounded-lg font-medium"
                    >
                      Test
                    </button>
                  </div>
                  <p className="text-xs text-gray-400">Volume: {Math.round(prefs.sound_volume * 100)}%</p>
                </div>
              )}
            </div>

            {/* Browser Push Notifications */}
            <div className="py-3 px-0">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">Browser Notifications</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {pushPermission === 'granted'
                      ? '✓ Enabled'
                      : pushPermission === 'denied'
                      ? '✗ Blocked in settings'
                      : 'Enable notifications'}
                  </p>
                </div>
                {pushPermission !== 'granted' && (
                  <button
                    onClick={handleRequestPushPermission}
                    disabled={saving}
                    className="flex-shrink-0 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                  >
                    Enable
                  </button>
                )}
                {pushPermission === 'granted' && (
                  <Check className="h-5 w-5 text-green-600 flex-shrink-0" />
                )}
              </div>
              {pushPermission === 'denied' && (
                <div className="mt-3 bg-red-50 rounded-lg p-2 flex gap-2 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <p>
                    Enable in browser settings to receive notifications.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}