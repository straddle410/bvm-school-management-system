import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Download, CalendarDays, Users, Clock, UserCheck, UserX, Sun, Coffee } from 'lucide-react';
import StaffAttendanceReportTable from './StaffAttendanceReportTable';

const QUICK_RANGES = [
  { label: 'This Week', getValue: () => getWeekRange(0) },
  { label: 'Last Week', getValue: () => getWeekRange(-1) },
  { label: 'This Month', getValue: () => getMonthRange(0) },
  { label: 'Last Month', getValue: () => getMonthRange(-1) },
  { label: 'Last 7 Days', getValue: () => getDaysBack(7) },
  { label: 'Last 30 Days', getValue: () => getDaysBack(30) },
];

function todayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getWeekRange(offset) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay();
  const monday = new Date(ist);
  monday.setUTCDate(ist.getUTCDate() - day + 1 + offset * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return { from: monday.toISOString().slice(0, 10), to: offset === 0 ? todayIST() : sunday.toISOString().slice(0, 10) };
}

function getMonthRange(offset) {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const m = ist.getUTCMonth() + offset;
  const start = new Date(Date.UTC(y, m, 1));
  const end = offset === 0 ? todayIST() : new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { from: start.toISOString().slice(0, 10), to: end };
}

function getDaysBack(days) {
  const to = todayIST();
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  ist.setUTCDate(ist.getUTCDate() - days + 1);
  return { from: ist.toISOString().slice(0, 10), to };
}

export default function StaffAttendanceReportTab({ academicYear }) {
  const [dateFrom, setDateFrom] = useState(() => getMonthRange(0).from);
  const [dateTo, setDateTo] = useState(() => getMonthRange(0).to);
  const [activeQuick, setActiveQuick] = useState('This Month');
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadStaff(); }, []);
  useEffect(() => { if (dateFrom && dateTo) loadRecords(); }, [dateFrom, dateTo, academicYear]);

  const loadStaff = async () => {
    const staff = await base44.entities.StaffAccount.filter({ is_active: true });
    setStaffList(staff);
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      const all = await base44.entities.StaffAttendance.filter({ academic_year: academicYear });
      const filtered = all.filter(r => r.date >= dateFrom && r.date <= dateTo);
      setRecords(filtered);
    } catch {
      toast.error('Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = (label, getValue) => {
    const { from, to } = getValue();
    setDateFrom(from);
    setDateTo(to);
    setActiveQuick(label);
  };

  // Build per-staff summary
  const staffSummary = useMemo(() => {
    const map = {};
    staffList.forEach(s => {
      map[s.id] = { id: s.id, name: s.name, designation: s.designation || s.role || '', present: 0, absent: 0, halfDay: 0, leave: 0, holiday: 0, records: [] };
    });
    records.forEach(r => {
      if (!map[r.staff_id]) return;
      map[r.staff_id].records.push(r);
      switch (r.status) {
        case 'Present': map[r.staff_id].present++; break;
        case 'Absent': map[r.staff_id].absent++; break;
        case 'Half Day': map[r.staff_id].halfDay++; break;
        case 'Leave': map[r.staff_id].leave++; break;
        case 'Holiday': map[r.staff_id].holiday++; break;
      }
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [staffList, records]);

  const totals = useMemo(() => {
    return staffSummary.reduce((acc, s) => ({
      present: acc.present + s.present,
      absent: acc.absent + s.absent,
      halfDay: acc.halfDay + s.halfDay,
      leave: acc.leave + s.leave,
      holiday: acc.holiday + s.holiday,
    }), { present: 0, absent: 0, halfDay: 0, leave: 0, holiday: 0 });
  }, [staffSummary]);

  return (
    <div className="space-y-4">
      {/* Quick Range Selectors */}
      <div className="flex flex-wrap gap-2">
        {QUICK_RANGES.map(q => (
          <button
            key={q.label}
            onClick={() => handleQuick(q.label, q.getValue)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
              activeQuick === q.label
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      <div className="flex items-center gap-2 flex-wrap">
        <CalendarDays className="h-4 w-4 text-slate-500" />
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setActiveQuick(''); }}
          className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm"
        />
        <span className="text-sm text-gray-500">to</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setActiveQuick(''); }}
          className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-2">
        <SummaryCard icon={UserCheck} label="Present" count={totals.present} color="text-green-600 bg-green-50 dark:bg-green-900/30" />
        <SummaryCard icon={UserX} label="Absent" count={totals.absent} color="text-red-600 bg-red-50 dark:bg-red-900/30" />
        <SummaryCard icon={Clock} label="Half Day" count={totals.halfDay} color="text-yellow-600 bg-yellow-50 dark:bg-yellow-900/30" />
        <SummaryCard icon={Coffee} label="Leave" count={totals.leave} color="text-blue-600 bg-blue-50 dark:bg-blue-900/30" />
        <SummaryCard icon={Sun} label="Holiday" count={totals.holiday} color="text-gray-600 bg-gray-50 dark:bg-gray-800" />
      </div>

      {/* Staff-wise Report Table */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-7 h-7 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <StaffAttendanceReportTable staffSummary={staffSummary} dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, count, color }) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className={`p-3 flex flex-col items-center gap-1 ${color} rounded-xl`}>
        <Icon className="h-4 w-4" />
        <span className="text-lg font-bold">{count}</span>
        <span className="text-[10px] font-medium">{label}</span>
      </CardContent>
    </Card>
  );
}