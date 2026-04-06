import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, UserCheck, UserX, Clock, Coffee, Sun, PlusCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LeaveApplyModal from '@/components/staff/LeaveApplyModal';
import moment from 'moment';

function todayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getMonthsFromDateRange(startDate, endDate) {
  const today = moment(todayIST());
  const start = moment(startDate).startOf('month');
  const end = moment.min(moment(endDate).startOf('month'), today.startOf('month'));
  const months = [];
  let cur = start.clone();
  while (cur.isSameOrBefore(end, 'month')) {
    months.push(cur.clone());
    cur.add(1, 'month');
  }
  return months;
}

const STATUS_COLORS = {
  Present: 'bg-green-50 text-green-700 border-green-200',
  Absent: 'bg-red-50 text-red-700 border-red-200',
  'Half Day': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  Leave: 'bg-blue-50 text-blue-700 border-blue-200',
  Holiday: 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function StaffAttendanceOverview({ staffId, academicYear, staffName, designation }) {
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [myLeaves, setMyLeaves] = useState([]);
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(moment(todayIST()).format('YYYY-MM'));
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!academicYear) return;
    base44.entities.AcademicYear.filter({ year: academicYear })
      .then(results => {
        const ay = results[0];
        if (ay?.start_date && ay?.end_date) {
          const m = getMonthsFromDateRange(ay.start_date, ay.end_date);
          setMonths(m);
          if (m.length > 0) setSelectedMonth(m[m.length - 1].format('YYYY-MM'));
        }
      })
      .catch(() => {});
  }, [academicYear]);

  useEffect(() => {
    if (!staffId || !academicYear) return;
    base44.entities.StaffLeave.filter({ staff_id: staffId, academic_year: academicYear })
      .then(all => { all.sort((a,b) => b.from_date.localeCompare(a.from_date)); setMyLeaves(all); })
      .catch(() => {});
  }, [staffId, academicYear]);

  useEffect(() => {
    if (!staffId || !academicYear || !selectedMonth) return;
    setLoading(true);
    setError(null);
    const from = moment(selectedMonth).startOf('month').format('YYYY-MM-DD');
    const to = moment(selectedMonth).endOf('month').format('YYYY-MM-DD');
    base44.entities.StaffAttendance.filter({ staff_id: staffId, academic_year: academicYear })
      .then(all => {
        const filtered = all.filter(r => r.date >= from && r.date <= to);
        filtered.sort((a, b) => b.date.localeCompare(a.date));
        setRecords(filtered);
      })
      .catch(() => setError('Failed to load attendance'))
      .finally(() => setLoading(false));
  }, [staffId, academicYear, selectedMonth]);

  const summary = useMemo(() => {
    return records.reduce((acc, r) => {
      if (r.status === 'Present') acc.present++;
      else if (r.status === 'Absent') acc.absent++;
      else if (r.status === 'Half Day') acc.halfDay++;
      else if (r.status === 'Leave') acc.leave++;
      else if (r.status === 'Holiday') acc.holiday++;
      return acc;
    }, { present: 0, absent: 0, halfDay: 0, leave: 0, holiday: 0 });
  }, [records]);

  const leaveStatus = { Pending: 'text-yellow-600', Approved: 'text-green-600', Rejected: 'text-red-500' };

  if (!staffId) return (
    <div className="text-center text-sm text-gray-400 py-8">Staff account not linked.</div>
  );

  return (
    <div className="space-y-4">
      {/* Apply Leave button */}
      <div className="flex justify-end">
        <Button onClick={() => setShowLeaveModal(true)} className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white">
          <PlusCircle className="h-4 w-4" /> Apply Leave
        </Button>
      </div>

      {/* My Leave Requests */}
      {myLeaves.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4">
          <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3 text-sm">My Leave Requests</h3>
          <div className="space-y-2">
            {myLeaves.slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between text-sm border-b dark:border-gray-700 pb-2 last:border-0 last:pb-0">
                <div>
                  <span className="font-medium">{moment(l.from_date).format('MMM D')} – {moment(l.to_date).format('MMM D')}</span>
                  <span className="text-gray-400 ml-2">{l.leave_type}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${leaveStatus[l.status]}`}>{l.status}</span>
                  <span className="text-xs text-gray-400">{l.pay_type}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Month selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Month:</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          {months.map(m => (
            <option key={m.format('YYYY-MM')} value={m.format('YYYY-MM')}>
              {m.format('MMMM YYYY')}
            </option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { label: 'Present', count: summary.present, icon: UserCheck, cls: 'bg-green-50 text-green-700 dark:bg-green-900/30' },
          { label: 'Absent', count: summary.absent, icon: UserX, cls: 'bg-red-50 text-red-700 dark:bg-red-900/30' },
          { label: 'Half Day', count: summary.halfDay, icon: Clock, cls: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30' },
          { label: 'Leave', count: summary.leave, icon: Coffee, cls: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30' },
          { label: 'Holiday', count: summary.holiday, icon: Sun, cls: 'bg-gray-50 text-gray-600 dark:bg-gray-800' },
        ].map(({ label, count, icon: Icon, cls }) => (
          <Card key={label} className="border-0 shadow-sm">
            <CardContent className={`p-3 flex flex-col items-center gap-1 rounded-xl ${cls}`}>
              <Icon className="h-4 w-4" />
              <span className="text-lg font-bold">{count}</span>
              <span className="text-[10px] font-medium">{label}</span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Records list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
      ) : error ? (
        <div className="text-center text-sm text-red-500 py-4"><AlertCircle className="inline h-4 w-4 mr-1" />{error}</div>
      ) : records.length === 0 ? (
        <div className="text-center text-sm text-gray-400 py-8">No attendance records for {moment(selectedMonth).format('MMMM YYYY')}.</div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Date</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Check-in</th>
                <th className="text-left px-4 py-2 font-semibold text-gray-600 dark:text-gray-300">Check-out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {records.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2 text-gray-700 dark:text-gray-300">{moment(r.date).format('MMM D, YYYY')}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[r.status] || ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.checkin_time || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{r.checkout_time || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeaveApplyModal
        open={showLeaveModal}
        onClose={() => { setShowLeaveModal(false); 
          base44.entities.StaffLeave.filter({ staff_id: staffId, academic_year: academicYear })
            .then(all => { all.sort((a,b) => b.from_date.localeCompare(a.from_date)); setMyLeaves(all); })
            .catch(() => {});
        }}
        staffId={staffId}
        staffName={staffName || ''}
        designation={designation || ''}
        academicYear={academicYear}
      />
    </div>
  );
}