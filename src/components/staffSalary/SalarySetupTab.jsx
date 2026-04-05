import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, IndianRupee } from 'lucide-react';

export default function SalarySetupTab({ academicYear }) {
  const [staffList, setStaffList] = useState([]);
  const [configs, setConfigs] = useState({});
  const [edits, setEdits] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, [academicYear]);

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
  // dailyRate is no longer shown here — it's dynamic per month (see Salary Report tab)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600 dark:text-gray-400">
          Define monthly gross salary for each staff. Daily rate is auto-calculated based on actual working days each month.
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
              const e = edits[s.id] || { monthly_salary: '' };
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
                                  {e.monthly_salary > 0 && (
                                    <div className="text-xs text-slate-500 dark:text-gray-400 mt-4">
                                       Daily rate = Monthly ÷ <span className="text-blue-500">actual working days</span> (auto-calculated)
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