import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Clock } from 'lucide-react';

export default function KioskSettingsTab() {
  const [kioskSettings, setKioskSettings] = useState(null);
  const [lateTime, setLateTime] = useState('09:30');
  const [earlyTime, setEarlyTime] = useState('16:00');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.KioskSettings.list().then(list => {
      if (list?.[0]) {
        setKioskSettings(list[0]);
        setLateTime(list[0].late_checkin_time || '09:30');
        setEarlyTime(list[0].early_checkout_time || '16:00');
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { late_checkin_time: lateTime, early_checkout_time: earlyTime, label: 'default' };
      if (kioskSettings?.id) {
        await base44.entities.KioskSettings.update(kioskSettings.id, payload);
      } else {
        const created = await base44.entities.KioskSettings.create(payload);
        setKioskSettings(created);
      }
      toast.success('Kiosk time settings saved');
    } catch { toast.error('Failed to save kiosk settings'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-7 h-7 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="font-bold text-slate-800 dark:text-white text-base">Half-Day Time Rules</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-5">
            Staff scanning the kiosk <strong>after</strong> the late check-in time will be marked <strong>Half Day</strong>.<br />
            Staff scanning <strong>before</strong> the early check-out time on their 2nd scan will be marked <strong>Half Day</strong>.
          </p>

          <div className="flex gap-8 flex-wrap items-end">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                ⏰ Late Check-in After
              </label>
              <input
                type="time"
                value={lateTime}
                onChange={e => setLateTime(e.target.value)}
                className="border-2 border-amber-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-2.5 text-lg font-medium"
              />
              <p className="text-xs text-amber-600 mt-1 font-medium">Scanning after this → Half Day</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                ⏰ Early Check-out Before
              </label>
              <input
                type="time"
                value={earlyTime}
                onChange={e => setEarlyTime(e.target.value)}
                className="border-2 border-amber-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-2.5 text-lg font-medium"
              />
              <p className="text-xs text-amber-600 mt-1 font-medium">Checking out before this → Half Day</p>
            </div>

            <Button onClick={save} disabled={saving}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-8 py-2.5">
              <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving...' : 'Save Times'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm dark:bg-gray-800">
        <CardContent className="p-4">
          <h4 className="font-semibold text-slate-700 dark:text-gray-300 mb-3">How the Kiosk Works</h4>
          <ul className="space-y-2 text-sm text-slate-600 dark:text-gray-400">
            <li>✅ <strong>1st scan</strong> = Check-in. If on time → <span className="text-green-600 font-semibold">Present</span>. If after late time → <span className="text-orange-500 font-semibold">Half Day</span>.</li>
            <li>👋 <strong>2nd scan</strong> = Check-out. If after early time → keeps current status. If before early time → <span className="text-orange-500 font-semibold">Half Day</span>.</li>
            <li>🔒 Admin must click <strong>"Init Day (All Absent)"</strong> in the Attendance tab each morning to initialize the day before the kiosk starts scanning.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}