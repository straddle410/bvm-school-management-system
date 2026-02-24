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
    // Check permission every time - Edge caches it
    checkPushPermission();
    // Auto-enable only if permission is default
    if (Notification.permission === 'default') {
      autoEnableNotifications();
    }
  }, [studentId]);

  const autoEnableNotifications = async () => {
    if (!('Notification' in window)) return;
    
    try {
      console.log('Current permission:', Notification.permission);
      
      if (Notification.permission === 'granted') {
        // Permission already granted in Chrome - register and subscribe
        await registerServiceWorker();
        setPushPermission('granted');
      } else if (Notification.permission === 'default') {
        // Ask for permission
        const permission = await Notification.requestPermission();
        console.log('Permission result:', permission);
        
        if (permission === 'granted') {
          await registerServiceWorker();
        }
        setPushPermission(permission);
      }
    } catch (err) {
      console.warn('Auto-enable notifications failed:', err);
    }
  };

  const autoSubscribeIfNeeded = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        let subscription = await reg.pushManager.getSubscription();
        
        if (!subscription) {
          const vapidPublicKey = 'BJ0I5_CkKt4tB_5gVLWH3oXz1_-35i-jqr0H5wJXnJhCYzCXAzWBDBqk1wYKCn_FhhZHvUKMxNVccQ0V6vJoJ2A';
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidPublicKey,
          });
          
          if (subscription && prefs?.id) {
            const subscriptionJson = subscription.toJSON();
            await base44.entities.StudentNotificationPreference.update(prefs.id, { 
              browser_push_enabled: true,
              push_subscription: JSON.stringify(subscriptionJson)
            });
          }
        }
      } catch (err) {
        console.warn('Auto-subscribe failed:', err);
      }
    }
  };

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
      const permission = Notification.permission;
      console.log('Current Notification.permission:', permission);
      setPushPermission(permission);
    }
  };

  const refreshPermissionStatus = async () => {
    if (!('Notification' in window)) return;
    
    // Force recheck by clearing any cached state
    const currentPerm = Notification.permission;
    console.log('Refreshing permission, current:', currentPerm);
    setPushPermission(currentPerm);
    
    if (currentPerm === 'granted') {
      await registerServiceWorker();
      toast.success('Notifications enabled!');
    } else if (currentPerm === 'denied') {
      toast.error('Still blocked - Edge cached it. Try: Settings → Privacy → Notifications → Remove this site, then refresh.');
    } else {
      toast.info('Permission pending - click Enable to proceed');
    }
  };

  const handleRequestPushPermission = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser does not support notifications');
      return;
    }

    try {
      const currentPermission = Notification.permission;
      console.log('Current permission before request:', currentPermission);
      
      if (currentPermission === 'granted') {
        await registerServiceWorker();
        toast.success('Already enabled');
        return;
      }

      if (currentPermission === 'denied') {
        toast.error('Still blocked. Go to Edge Settings → Privacy → Notifications → find this site → Remove it. Then refresh and try again.');
        return;
      }

      // Permission is 'default' - request permission
      const permission = await Notification.requestPermission();
      console.log('Permission after request:', permission);
      setPushPermission(permission);

      if (permission === 'granted') {
        await registerServiceWorker();
        toast.success('Notifications enabled!');
      } else if (permission === 'denied') {
        toast.error('You blocked it. Remove site from Settings → Privacy → Notifications.');
      }
    } catch (err) {
      console.error('Permission request error:', err);
      toast.error('Error: ' + err.message);
    }
  };

  const registerServiceWorker = async () => {
    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.register('/functions/serviceworker');
        console.log('Service Worker registered');
        
        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
          const vapidPublicKey = 'BJ0I5_CkKt4tB_5gVLWH3oXz1_-35i-jqr0H5wJXnJhCYzCXAzWBDBqk1wYKCn_FhhZHvUKMxNVccQ0V6vJoJ2A';
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: vapidPublicKey,
          });
        }
        
        if (subscription) {
          await handleUpdatePreference({ browser_push_enabled: true });
        }
      } catch (err) {
        console.warn('Service Worker failed:', err);
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

  const handleDisablePushNotifications = async () => {
    setSaving(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const subscription = await reg.pushManager.getSubscription();
        
        // Unsubscribe from push notifications
        if (subscription) {
          await subscription.unsubscribe();
          console.log('Push subscription removed');
        }
      }
      
      // Update preferences
      await handleUpdatePreference({ 
        browser_push_enabled: false,
        push_subscription: null
      });
      
      toast.success('Push notifications disabled');
    } catch (err) {
      console.error('Error disabling push notifications:', err);
      toast.error('Failed to disable notifications');
    } finally {
      setSaving(false);
    }
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
                <div className="flex gap-2 flex-shrink-0">
                  {pushPermission !== 'granted' && (
                    <button
                      onClick={refreshPermissionStatus}
                      disabled={saving}
                      className="text-xs bg-gray-200 hover:bg-gray-300 text-gray-700 px-2 py-1.5 rounded-lg font-medium"
                      title="Refresh to check if you've enabled notifications in Chrome"
                    >
                      Refresh
                    </button>
                  )}
                  {pushPermission === 'granted' && (
                    <button
                      onClick={handleDisablePushNotifications}
                      disabled={saving}
                      className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                    >
                      Disable
                    </button>
                  )}
                  {pushPermission !== 'granted' && (
                    <button
                      onClick={handleRequestPushPermission}
                      disabled={saving}
                      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium whitespace-nowrap"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
              {pushPermission === 'default' && (
                <div className="mt-3 bg-blue-50 rounded-lg p-3 space-y-2 border border-blue-200">
                  <div className="flex gap-2 text-xs text-blue-700">
                    <Bell className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium mb-2">Get instant notifications from school</p>
                      <p className="text-blue-600">Chrome will ask for permission when you click "Enable" – just allow it to receive notices, messages, and updates.</p>
                    </div>
                  </div>
                </div>
              )}
              {pushPermission === 'denied' && (
                <div className="mt-3 bg-red-50 rounded-lg p-3 space-y-2 border border-red-200">
                  <div className="flex gap-2 text-xs text-red-700">
                    <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium mb-2">Notifications are blocked. Re-enable in Chrome:</p>
                      <ol className="list-decimal list-inside space-y-1 text-red-600">
                        <li>Click the lock icon in the address bar</li>
                        <li>Find "Notifications" and select "Allow"</li>
                        <li>Refresh the page</li>
                        <li>Click "Enable" button again</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}