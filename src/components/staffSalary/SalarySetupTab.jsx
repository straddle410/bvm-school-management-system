import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, IndianRupee, Clock } from 'lucide-react';

export default function SalarySetupTab({ academicYear }) {
  const [staffList, setStaffList] = useState([]);
  const [configs, setConfigs] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Kiosk time settings
  const [kioskSettings, setKioskSettings] = useState(null);
  const [lateTime, setLateTime] = useState('09:30');
  const [earlyTime, setEarlyTime] = useState('16:00');
  const [savingKiosk, setSavingKiosk] = useState(false);

  useEffect(() => {
    loadData();
    loadKioskSettings();
  }, [academicYear]);

  const loadKioskSettings = async () => {
    try {
      const list = await base44.entities.KioskSettings.list();
      if (list?.[0]) {
        setKioskSettings(list[0]);
        setLateTime(list[0].late_checkin_time || '09:30');
        setEarlyTime(list[0].early_checkout_time || '16:00');
      }
    } catch {}
  };

  const saveKioskSettings = async () => {
    setSavingKiosk(true);
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
    finally { setSavingKiosk(false); }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [staff, cfgs] = await Promise.all([
        base44.entities.StaffAccount.filter({ is_active: true }),
        base44.entities.StaffSalaryConfig.filter({ academic_year: academicYear }),
      ]);
      setStaffList(staff);
      const map = {};
      cfgs.forEach(c => { map[c.staff_id] = c; });
      setConfigs(map);
      const initEdits = {};
      staff.forEach(s => {
        const cfg = map[s.id];
        initEdits[s.id] = {
          monthly_salary: cfg?.monthly_salary ?? '',
          working_days_per_month: cfg?.working_days_per_month ?? 26,
        };
      });
      setEdits(initEdits);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const setField = (staffId, field, value) => {
    setEdits(prev => ({ ...prev, [staffId]: { ...prev[staffId], [field]: value } }));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await Promise.all(staffList.map(async (s) => {
        const edit = edits[s.id];
        if (!edit?.monthly_salary) return;
        const existing = configs[s.id];
        const payload = {
          staff_id: s.id,
          staff_name: s.name,
          designation: s.designation || s.role || '',
          monthly_salary: parseFloat(edit.monthly_salary) || 0,
          working_days_per_month: parseInt(edit.working_days_per_month) || 26,
          academic_year: academicYear,
        };
        if (existing?.id) {
          await base44.entities.StaffSalaryConfig.update(existing.id, payload);
        } else {
          await base44.entities.StaffSalaryConfig.create({ ...payload, effective_from: new Date().toISOString().slice(0, 10) });
        }
      }));
      toast.success('Salary configuration saved');
      loadData();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const totalMonthly = staffList.reduce((sum, s) => sum + (parseFloat(edits[s.id]?.monthly_salary) || 0), 0);

  return (
    <div className="space-y-6">

      {/* Kiosk Time Settings */}
      <Card className="border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <h3 className="font-bold text-slate-800 dark:text-white text-base">Kiosk Half-Day Time Rules</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
            Staff scanning the kiosk <strong>after</strong> the late check-in time → marked <strong>Half Day</strong>.<br />
            Staff scanning <strong>before</strong> the early check-out time on 2nd scan → marked <strong>Half Day</strong>.
          </p>
          <div className="flex gap-6 flex-wrap items-end">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                ⏰ Late Check-in After
              </label>
              <input
                type="time"
                value={lateTime}
                onChange={e => setLateTime(e.target.value)}
                className="border-2 border-amber-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm font-medium"
              />
              <p className="text-[10px] text-amber-600 mt-0.5 font-medium">Scanning after this → Half Day</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 block mb-1">
                ⏰ Early Check-out Before
              </label>
              <input
                type="time"
                value={earlyTime}
                onChange={e => setEarlyTime(e.target.value)}
                className="border-2 border-amber-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm font-medium"
              />
              <p className="text-[10px] text-amber-600 mt-0.5 font-medium">Checking out before this → Half Day</p>
            </div>
            <Button onClick={saveKioskSettings} disabled={savingKiosk}
              className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6">
              <Save className="h-4 w-4 mr-1" /> {savingKiosk ? 'Saving...' : 'Save Times'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Salary Config */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-gray-400">
          Define monthly gross salary for each staff. Daily rate = Monthly ÷ Working Days.
        </p>
        <Button size="sm" onClick={saveAll} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save All'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          <div className="space-y-2">
            {staffList.map(s => {
              const e = edits[s.id] || { monthly_salary: '', working_days_per_month: 26 };
              const dailyRate = e.monthly_salary ? (parseFloat(e.monthly_salary) / (parseInt(e.working_days_per_month) || 26)) : 0;
              return (
                <Card key={s.id} className="border-0 shadow-sm dark:bg-gray-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{s.name}</p>
                        <p className="text-xs text-slate-500">{s.designation || s.role}</p>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap">
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Monthly Salary (₹)</label>
                          <input
                            type="number"
                            value={e.monthly_salary}
                            onChange={ev => setField(s.id, 'monthly_salary', ev.target.value)}
                            placeholder="e.g. 25000"
                            className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-1.5 text-sm w-32"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 block mb-0.5">Working Days/Month</label>
                          <input
                            type="number"
                            value={e.working_days_per_month}
                            onChange={ev => setField(s.id, 'working_days_per_month', ev.target.value)}
                            className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-1.5 text-sm w-24"
                          />
                        </div>
                        {dailyRate > 0 && (
                          <div className="text-xs text-slate-500 dark:text-gray-400 mt-4">
                            Daily rate: <span className="font-semibold text-slate-700 dark:text-gray-200">₹{dailyRate.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="sticky bottom-0 bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
            <span className="font-semibold text-slate-700 dark:text-gray-300 flex items-center gap-1">
              <IndianRupee className="h-4 w-4" /> Total Monthly Payroll
            </span>
            <span className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
              ₹{totalMonthly.toLocaleString('en-IN')}
            </span>
          </div>
        </>
      )}
    </div>
  );
}