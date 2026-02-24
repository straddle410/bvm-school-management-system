import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function StudentPushNotifications({ studentId }) {
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  const handleEnablePush = async () => {
    if (!('Notification' in window)) {
      toast.error('Browser does not support notifications');
      return;
    }

    if (Notification.permission === 'granted') {
      toast.info('Push notifications already enabled');
      return;
    }

    if (Notification.permission === 'denied') {
      toast.error('Notifications blocked in browser settings. Re-enable them to continue.');
      return;
    }

    setLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm === 'granted') {
        // Register service worker
        if ('serviceWorker' in navigator) {
          const response = await fetch('/functions/serviceworker');
          const swCode = await response.text();
          const blob = new Blob([swCode], { type: 'application/javascript' });
          const swUrl = URL.createObjectURL(blob);

          await navigator.serviceWorker.register(swUrl);
          toast.success('Push notifications enabled!');
        }
      } else {
        toast.error('You blocked push notifications');
      }
    } catch (err) {
      console.error('Error enabling push notifications:', err);
      toast.error('Failed to enable push notifications');
    }
    setLoading(false);
  };

  const handleDisablePush = async () => {
    setLoading(true);
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let reg of registrations) {
          await reg.unregister();
        }
      }
      toast.success('Push notifications disabled');
    } catch (err) {
      console.error('Error disabling push:', err);
      toast.error('Failed to disable push notifications');
    }
    setLoading(false);
  };

  return (
    <Card className="bg-white rounded-2xl shadow-sm p-4 sm:p-5">
      <CardHeader className="border-0 p-0 mb-4">
        <CardTitle className="font-bold text-gray-800 flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" /> Browser Notifications
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 p-0">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Push Notifications</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {permission === 'granted'
                ? '✓ Enabled'
                : permission === 'denied'
                ? '✗ Blocked'
                : 'Not enabled yet'}
            </p>
          </div>
          <div className="flex gap-2">
            {permission === 'granted' && (
              <button
                onClick={handleDisablePush}
                disabled={loading}
                className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
              >
                Disable
              </button>
            )}
            {permission !== 'granted' && (
              <button
                onClick={handleEnablePush}
                disabled={loading}
                className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
              >
                {loading ? 'Loading...' : 'Enable'}
              </button>
            )}
          </div>
        </div>

        {permission === 'denied' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
            <p className="font-medium mb-1">Notifications blocked in browser</p>
            <p>Go to browser settings and re-enable notifications for this site to receive push alerts.</p>
          </div>
        )}

        {permission === 'default' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            <p className="font-medium mb-1">Get instant school notifications</p>
            <p>Enable push notifications to receive alerts about notices, quizzes, messages, and more.</p>
          </div>
        )}

        {permission === 'granted' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700 flex items-center gap-2">
            <Check className="h-4 w-4 flex-shrink-0" />
            <p>Push notifications are active. You'll receive school alerts on this device.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}