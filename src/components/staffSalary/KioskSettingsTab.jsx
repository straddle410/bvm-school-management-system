import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Clock, Lock, Eye, EyeOff } from 'lucide-react';

export default function KioskSettingsTab() {
  const [kioskSettings, setKioskSettings] = useState(null);
  const [lateTime, setLateTime] = useState('09:30');
  const [earlyTime, setEarlyTime] = useState('16:00');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // PIN state
  const [passcodeRecord, setPasscodeRecord] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.entities.KioskSettings.list(),
      base44.entities.KioskPasscode.list(),
    ]).then(([list, passcodes]) => {
      if (list?.[0]) {
        setKioskSettings(list[0]);
        setLateTime(list[0].late_checkin_time || '09:30');
        setEarlyTime(list[0].early_checkout_time || '16:00');
      }
      if (passcodes?.[0]) {
        setPasscodeRecord(passcodes[0]);
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

  const savePin = async () => {
    if (!/^\d{6}$/.test(newPin)) { toast.error('PIN must be exactly 6 digits.'); return; }
    setSavingPin(true);
    const session = (() => { try { return JSON.parse(localStorage.getItem('staff_session')); } catch { return null; } })();
    try {
      const payload = { pin: newPin, last_updated_by: session?.email || '', is_active: true };
      if (passcodeRecord?.id) {
        await base44.entities.KioskPasscode.update(passcodeRecord.id, payload);
        setPasscodeRecord(prev => ({ ...prev, ...payload }));
      } else {
        const created = await base44.entities.KioskPasscode.create(payload);
        setPasscodeRecord(created);
      }
      setNewPin('');
      toast.success('Kiosk PIN updated successfully');
    } catch { toast.error('Failed to update PIN'); }
    finally { setSavingPin(false); }
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-7 h-7 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">

      {/* PIN Management */}
      <Card className="border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-5 w-5 text-indigo-600" />
            <h3 className="font-bold text-slate-800 dark:text-white text-base">Kiosk Unlock PIN</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
            This 6-digit PIN must be entered on the kiosk device before the QR scanner activates. Only admins can change it.
          </p>

          {passcodeRecord && (
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-slate-600 dark:text-gray-400">Current PIN:</span>
              <span className="font-mono text-lg font-bold text-indigo-700 dark:text-indigo-300 tracking-widest">
                {showPin ? passcodeRecord.pin : '● ● ● ● ● ●'}
              </span>
              <button onClick={() => setShowPin(v => !v)} className="text-slate-400 hover:text-slate-600 p-1">
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          )}

          <div className="flex gap-3 items-end flex-wrap">
            <div>
              <label className="text-sm font-semibold text-slate-700 dark:text-gray-300 block mb-1">New PIN (6 digits)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={newPin}
                onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter new 6-digit PIN"
                className="border-2 border-indigo-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-4 py-2.5 text-lg font-medium w-52 tracking-widest"
              />
            </div>
            <Button onClick={savePin} disabled={savingPin || newPin.length !== 6}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2.5">
              <Lock className="h-4 w-4 mr-2" /> {savingPin ? 'Saving...' : 'Update PIN'}
            </Button>
          </div>
          {passcodeRecord?.last_updated_by && (
            <p className="text-xs text-slate-400 mt-2">Last updated by: {passcodeRecord.last_updated_by}</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">

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