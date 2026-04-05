import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CalendarDays, Save, RefreshCw } from 'lucide-react';

const STATUS_COLORS = {
  Present: 'bg-green-100 text-green-700 border-green-200',
  Absent: 'bg-red-100 text-red-700 border-red-200',
  'Half Day': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Leave: 'bg-blue-100 text-blue-700 border-blue-200',
  Holiday: 'bg-gray-100 text-gray-600 border-gray-200',
};

const STATUSES = ['Present', 'Absent', 'Half Day', 'Leave', 'Holiday'];

export default function StaffAttendanceTab({ academicYear }) {
  const [staffList, setStaffList] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [date, setDate] = useState(() => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    return ist.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);

  useEffect(() => { loadData(); }, [date, academicYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [staff, attendance] = await Promise.all([
        base44.entities.StaffAccount.filter({ is_active: true }),
        base44.entities.StaffAttendance.filter({ date, academic_year: academicYear }),
      ]);
      setStaffList(staff);
      const map = {};
      attendance.forEach(a => { map[a.staff_id] = a; });
      setAttendanceMap(map);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Initialize today: mark all staff without a record as Absent
  const initializeDay = async () => {
    setInitializing(true);
    const session = (() => { try { return JSON.parse(localStorage.getItem('staff_session')); } catch { return null; } })();
    try {
      const unrecorded = staffList.filter(s => !attendanceMap[s.id]?.id);
      if (unrecorded.length === 0) { toast.info('All staff already have attendance records for this date'); setInitializing(false); return; }
      await Promise.all(unrecorded.map(s =>
        base44.entities.StaffAttendance.create({
          staff_id: s.id,
          staff_name: s.name,
          date,
          status: 'Absent',
          academic_year: academicYear,
          marked_by: session?.email || 'ADMIN',
          remarks: 'Pre-initialized as Absent',
        })
      ));
      toast.success(`${unrecorded.length} staff initialized as Absent`);
      loadData();
    } catch { toast.error('Failed to initialize attendance'); }
    finally { setInitializing(false); }
  };

  const setStatus = (staffId, status) => {
    setAttendanceMap(prev => ({
      ...prev,
      [staffId]: { ...(prev[staffId] || {}), status },
    }));
  };

  const saveAttendance = async () => {
    setSaving(true);
    const session = (() => { try { return JSON.parse(localStorage.getItem('staff_session')); } catch { return null; } })();
    try {
      await Promise.all(staffList.map(async (s) => {
        const existing = attendanceMap[s.id];
        const status = existing?.status || 'Absent';
        if (existing?.id) {
          await base44.entities.StaffAttendance.update(existing.id, { status });
        } else {
          await base44.entities.StaffAttendance.create({
            staff_id: s.id,
            staff_name: s.name,
            date,
            status,
            academic_year: academicYear,
            marked_by: session?.email || '',
          });
        }
      }));
      toast.success('Attendance saved');
      loadData();
    } catch {
      toast.error('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const summary = staffList.reduce((acc, s) => {
    const st = attendanceMap[s.id]?.status || 'Present';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Date picker + summary */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-slate-500" />
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(summary).map(([st, count]) => (
            <Badge key={st} variant="outline" className={STATUS_COLORS[st]}>{st}: {count}</Badge>
          ))}
        </div>
        <Button size="sm" onClick={initializeDay} disabled={initializing} variant="outline" className="border-amber-400 text-amber-700 hover:bg-amber-50">
          <RefreshCw className="h-4 w-4 mr-1" /> {initializing ? 'Initializing...' : 'Init Day (All Absent)'}
        </Button>
        <Button size="sm" onClick={saveAttendance} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Save className="h-4 w-4 mr-1" /> {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : staffList.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-slate-500">No active staff found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {staffList.map(s => {
            const status = attendanceMap[s.id]?.status || 'Absent';
            return (
              <Card key={s.id} className="border-0 shadow-sm dark:bg-gray-800">
                <CardContent className="p-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 dark:text-white truncate">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.designation || s.role}</p>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {STATUSES.map(st => (
                      <button
                        key={st}
                        onClick={() => setStatus(s.id, st)}
                        className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${status === st ? STATUS_COLORS[st] + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-600'}`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}