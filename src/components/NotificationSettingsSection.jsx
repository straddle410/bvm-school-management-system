import React, { useState, useEffect } from 'react';
import { notificationService } from './notificationService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Bell, Volume2, Loader2 } from 'lucide-react';
import { toast } from "sonner";

export default function NotificationSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await notificationService.getPreferences();
      if (prefs) {
        console.log('Setting preferences from database:', prefs);
        setPreferences(prefs);
      } else {
        // Create defaults only if nothing exists in DB
        console.log('No preferences found, creating defaults');
        const defaults = {
          notifications_enabled: true,
          message_notifications: true,
          sound_enabled: true,
          sound_volume: 0.7,
          browser_push_enabled: false,
        };
        setPreferences(defaults);
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
      setPreferences({
        notifications_enabled: true,
        message_notifications: true,
        sound_enabled: true,
        sound_volume: 0.7,
        browser_push_enabled: false,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await notificationService.savePreferences(preferences);
      // Reload preferences to verify persistence
      await loadPreferences();
      toast.success('Notification settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePushNotifications = async () => {
    setSaving(true);
    try {
      const hasPermission = await notificationService.requestPermission();
      if (hasPermission) {
        // Register service worker (if available)
        await notificationService.registerServiceWorker();
        const updated = { ...preferences, browser_push_enabled: true };
        setPreferences(updated);
        toast.success('Enabling push notifications...');
        // Save and reload to verify persistence
        await notificationService.savePreferences(updated);
        await loadPreferences();
        toast.success('Push notifications enabled');
      } else {
        toast.error('Permission denied for notifications');
      }
    } catch (error) {
      toast.error('Failed to enable push notifications');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handlePlayTestSound = () => {
    notificationService.playSound(preferences.sound_volume);
  };

  if (loading || !preferences) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure how you receive notifications for messages and updates
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master toggle */}
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
          <div>
            <Label className="text-base font-medium">All Notifications</Label>
            <p className="text-sm text-slate-500 mt-1">Enable/disable all notifications</p>
          </div>
          <Switch
            checked={preferences.notifications_enabled}
            onCheckedChange={(v) =>
              setPreferences({ ...preferences, notifications_enabled: v })
            }
          />
        </div>

        {preferences.notifications_enabled && (
          <>
            {/* Message notifications */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-200">
              <div>
                <Label className="text-base font-medium">Message Notifications</Label>
                <p className="text-sm text-slate-600 mt-1">Get notified when you receive messages</p>
              </div>
              <Switch
                checked={preferences.message_notifications}
                onCheckedChange={(v) =>
                  setPreferences({ ...preferences, message_notifications: v })
                }
              />
            </div>

            {preferences.message_notifications && (
              <>
                {/* Browser push notifications */}
                <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-medium">Browser Push Notifications</Label>
                      <p className="text-sm text-slate-500 mt-1">Receive notifications even when app is closed</p>
                    </div>
                  </div>
                  {!preferences.browser_push_enabled ? (
                    <Button
                      onClick={handleEnablePushNotifications}
                      variant="outline"
                      className="w-full sm:w-auto"
                    >
                      Enable Push Notifications
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <div className="h-2 w-2 rounded-full bg-green-600" />
                      Push notifications enabled
                    </div>
                  )}
                </div>

                {/* Sound toggle */}
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div>
                    <Label className="text-base font-medium">Notification Sound</Label>
                    <p className="text-sm text-slate-500 mt-1">Play sound when notification arrives</p>
                  </div>
                  <Switch
                    checked={preferences.sound_enabled}
                    onCheckedChange={(v) =>
                      setPreferences({ ...preferences, sound_enabled: v })
                    }
                  />
                </div>

                {/* Sound volume control */}
                {preferences.sound_enabled && (
                  <div className="p-4 bg-slate-50 rounded-xl space-y-4">
                    <div className="flex items-center gap-3">
                      <Volume2 className="h-5 w-5 text-slate-600 flex-shrink-0" />
                      <div className="flex-1">
                        <Label className="text-sm font-medium">Volume Level</Label>
                        <Slider
                          value={[preferences.sound_volume]}
                          onValueChange={(v) =>
                            setPreferences({ ...preferences, sound_volume: v[0] })
                          }
                          min={0}
                          max={1}
                          step={0.1}
                          className="mt-2"
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handlePlayTestSound}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      🔊 Play Test Sound
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#1a237e] hover:bg-[#283593]"
          >
            {saving ? 'Saving...' : 'Save Notification Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}