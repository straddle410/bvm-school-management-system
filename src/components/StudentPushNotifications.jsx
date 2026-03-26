import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const VAPID_PUBLIC_KEY = 'BEu90Ej8bFj1i1EVc5UzpZwIqXBfAl30wfVW7zqHRqaXGvBH1NZSKMJJjFRUBk-25YyJPcW2vJMGm7YzYMZ6q6I';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function StudentPushNotifications({ studentId }) {
  const [permission, setPermission] = useState('default');
  const [loading, setLoading] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
    // Check if already registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        setRegistered(regs.length > 0);
      });
    }
  }, []);

  const handleEnablePush = async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast.error('Browser does not support push notifications');
      return;
    }

    if (Notification.permission === 'denied') {
      toast.error(
        'Notifications are blocked. In Chrome: click the lock icon in address bar → Site settings → Notifications → Allow, then reload the page.'
      );
      return;
    }

    setLoading(true);
    try {
      // 1. Request permission
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error('Please allow notifications to continue.');
        setLoading(false);
        return;
      }

      // 2. Register Service Worker — must use same-origin URL (blob URLs fail in Android PWA)
      const reg = await navigator.serviceWorker.register(
        '/api/functions/firebaseMessagingServiceWorker',
        { scope: '/' }
      );
      await navigator.serviceWorker.ready;
      setRegistered(true);

      // 3. Subscribe with VAPID push
      let pushSub = await reg.pushManager.getSubscription();
      if (!pushSub) {
        pushSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // 4. Save token to database
      await base44.functions.invoke('saveStudentPushToken', {
        student_id: studentId,
        subscription: pushSub.toJSON(),
      });

      toast.success('Push notifications enabled! You will now receive school alerts on this device.');
    } catch (err) {
      console.error('Error enabling push notifications:', err);
      toast.error('Failed to enable push notifications: ' + err.message);
    }
    setLoading(false);
  };

  const handleDisablePush = async () => {
    setLoading(true);
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const reg of regs) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) await sub.unsubscribe();
          await reg.unregister();
        }
      }
      setRegistered(false);
      // Update DB
      await base44.functions.invoke('saveStudentPushToken', {
        student_id: studentId,
        subscription: null,
      });
      toast.success('Push notifications disabled.');
    } catch (err) {
      console.error('Error disabling push:', err);
      toast.error('Failed to disable push notifications');
    }
    setLoading(false);
  };

  const isEnabled = permission === 'granted' && registered;

  return (
    <Card className="bg-white rounded-2xl shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-600" /> Browser Push Notifications
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-800">Push Notifications</p>
            <p className={`text-xs mt-0.5 font-medium ${isEnabled ? 'text-green-600' : permission === 'denied' ? 'text-red-500' : 'text-gray-400'}`}>
              {isEnabled ? '✓ Active on this device' : permission === 'denied' ? '✗ Blocked in browser' : 'Not enabled'}
            </p>
          </div>
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
          ) : isEnabled ? (
            <button
              onClick={handleDisablePush}
              className="text-xs bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg font-medium transition"
            >
              Disable
            </button>
          ) : (
            <button
              onClick={handleEnablePush}
              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-medium transition"
            >
              Enable
            </button>
          )}
        </div>

        {permission === 'denied' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 space-y-1">
            <p className="font-semibold">Notifications blocked in browser</p>
            <p>To re-enable: Click the <b>🔒 lock icon</b> in the address bar → <b>Site settings</b> → <b>Notifications</b> → <b>Allow</b>, then reload the page.</p>
          </div>
        )}

        {permission === 'default' && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-blue-700">
            <p className="font-semibold mb-0.5">Get instant school alerts</p>
            <p>Receive notices, quiz alerts, results, and messages directly on your device — even when the app is closed.</p>
          </div>
        )}

        {isEnabled && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-700 flex items-start gap-2">
            <Check className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <p>You're all set! Push notifications are active. You'll receive school alerts on this device.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}