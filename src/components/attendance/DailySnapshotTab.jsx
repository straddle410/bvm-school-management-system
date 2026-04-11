import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Phone, History } from 'lucide-react';
import { format, subDays, getDay } from 'date-fns';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { deduplicateAttendanceRecords } from '@/components/attendanceCalculations';

const LoadingSpinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
  </div>
);

function getLastWorkingDays(fromDate, n) {
  const days = [];
  let cursor = new Date(fromDate + 'T00:00:00');
  while (days.length < n) {
    cursor = subDays(cursor, 1);
    if (getDay(cursor) !== 0) {
      days.push(format(cursor, 'yyyy-MM-dd'));
    }
  }
  return days;
}

export default function DailySnapshotTab() {
  const { academicYear } = useAcademicYear();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClassData, setSelectedClassData] = useState(null);
  const [viewType, setViewType] = useState('full_day');
  const [academicYearData, setAcademicYearData] = useState(null);
  const [showLast5Days, setShowLast5Days] = useState(false);
  const [last5DaysFilter, setLast5DaysFilter] = useState({ class_name: '', section: '' });

  useEffect(() => {
    const fetchAcademicYear = async () => {
      try {
        const data = await base44.entities.AcademicYear.filter({ year: academicYear });
        if (data.length > 0) setAcademicYearData(data[0]);
      } catch (err) {
        console.error('Failed to fetch academic year:', err);
      }
    };
    if (academicYear) fetchAcademicYear();
  }, [academicYear]);

  const { data: allStudents = [] } = useQuery({
    queryKey: ['daily-snapshot-students', academicYear],
    queryFn: () => base44.entities.Student.filter({ academic_year: academicYear, status: 'Published', is_deleted: false })
  });

  const { data: attendanceData = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['daily-snapshot-attendance', selectedDate, academicYear],
    queryFn: () => base44.entities.Attendance.filter({ academic_year: academicYear, date: selectedDate }),
    enabled: !!selectedDate && !showLast5Days
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['daily-snapshot-holidays', selectedDate, academicYear],
    queryFn: () => base44.entities.Holiday.filter({ academic_year: academicYear, date: selectedDate, status: 'Active' }),
    enabled: !!selectedDate && !showLast5Days
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ['daily-snapshot-overrides', selectedDate, academicYear],
    queryFn: () => base44.entities.HolidayOverride.filter({ academic_year: academicYear, date: selectedDate }),
    enabled: !!selectedDate && !showLast5Days
  });

  const { data: staffAccounts = [] } = useQuery({
    queryKey: ['staff-accounts', academicYear],
    queryFn: () => base44.entities.StaffAccount.list(),
    staleTime: 10 * 60 * 1000
  });

  // Last 5 working days
  const last5Days = useMemo(() => getLastWorkingDays(format(new Date(), 'yyyy-MM-dd'), 5), []);

  const { data: last5Attendance = [], isLoading: isLoadingLast5 } = useQuery({
    queryKey: ['last5-attendance', academicYear, last5Days.join(',')],
    queryFn: async () => {
      const results = await Promise.all(
        last5Days.map(d => base44.entities.Attendance.filter({ academic_year: academicYear, date: d }))
      );
      return results.flat();
    },
    enabled: showLast5Days && !!academicYear
  });

  const staffNameMap = useMemo(() => {
    const map = {};
    staffAccounts.forEach(staff => { if (staff.email) map[staff.email] = staff.name; });
    return map;
  }, [staffAccounts]);

  const reportData = useMemo(() => {
    if (!selectedDate || !allStudents.length) return [];
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const isSunday = getDay(dateObj) === 0;
    const isMarkedHoliday = holidays.length > 0;
    const overrideMap = {};
    overrides.forEach(o => { overrideMap[`${o.class_name}-${o.section}`] = true; });

    const isStudentHoliday = (student) => {
      if (overrideMap[`${student.class_name}-${student.section}`]) return false;
      return isSunday || isMarkedHoliday;
    };

    const groupMap = {};
    allStudents.forEach(student => {
      const key = `${student.class_name}__${student.section}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          class_name: student.class_name, section: student.section, total_students: 0,
          full_day: 0, half_day: 0, absent: 0, holiday: 0, unmarked: 0,
          full_day_students: [], half_day_students: [], absent_students: [],
          holiday_students: [], unmarked_students: [], submitted_by: 'Not Submitted', submitted_at: null
        };
      }
      groupMap[key].total_students++;
    });

    const dedupedAttendance = deduplicateAttendanceRecords(attendanceData);
    const attendanceMap = {};
    dedupedAttendance.forEach(record => {
      const key = `${record.class_name}__${record.section}__${record.student_id}`;
      if (!attendanceMap[key]) attendanceMap[key] = record;
    });

    const recordsByGroup = {};
    dedupedAttendance.forEach(record => {
      const key = `${record.class_name}__${record.section}`;
      if (!recordsByGroup[key]) recordsByGroup[key] = [];
      recordsByGroup[key].push(record);
    });

    const groupSubmissionMap = {};
    Object.entries(recordsByGroup).forEach(([key, groupRecords]) => {
      const validRecords = groupRecords.filter(r => r.status === 'Submitted');
      let latestRecord = validRecords.filter(r => r.submitted_at).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];
      if (!latestRecord && validRecords.length > 0) latestRecord = validRecords[0];
      let submittedBy = 'Not Submitted', submittedAt = null;
      if (latestRecord) {
        submittedAt = latestRecord.submitted_at;
        submittedBy = (latestRecord.auto_submitted || latestRecord.marked_by === 'SYSTEM')
          ? 'System Submitted'
          : (staffNameMap[latestRecord.marked_by] || latestRecord.marked_by || 'Not Submitted');
      }
      groupSubmissionMap[key] = { submitted_by: submittedBy, submitted_at: submittedAt };
    });

    allStudents.forEach(student => {
      const key = `${student.class_name}__${student.section}`;
      if (!groupMap[key]) return;
      const studentInfo = { name: student.name, phone: student.parent_phone || 'N/A' };
      if (isStudentHoliday(student)) {
        groupMap[key].holiday++;
        groupMap[key].holiday_students.push(studentInfo);
      } else {
        const record = attendanceMap[`${student.class_name}__${student.section}__${student.student_id}`];
        if (record) {
          const t = record.attendance_type || 'full_day';
          if (t === 'full_day') { groupMap[key].full_day++; groupMap[key].full_day_students.push(studentInfo); }
          else if (t === 'half_day') { groupMap[key].half_day++; groupMap[key].half_day_students.push(studentInfo); }
          else if (t === 'absent') { groupMap[key].absent++; groupMap[key].absent_students.push(studentInfo); }
        } else {
          groupMap[key].unmarked++;
          groupMap[key].unmarked_students.push(studentInfo);
        }
      }
    });

    Object.keys(groupMap).forEach(key => {
      const sub = groupSubmissionMap[key];
      if (sub) { groupMap[key].submitted_by = sub.submitted_by; groupMap[key].submitted_at = sub.submitted_at; }
    });

    return Object.values(groupMap).sort((a, b) => {
      if (a.class_name < b.class_name) return -1;
      if (a.class_name > b.class_name) return 1;
      return (a.section || '').localeCompare(b.section || '');
    });
  }, [selectedDate, allStudents, attendanceData, holidays, overrides, staffNameMap]);

  const totalStudents = reportData.reduce((s, r) => s + r.total_students, 0);
  const totalFullDay = reportData.reduce((s, r) => s + r.full_day, 0);
  const totalHalfDay = reportData.reduce((s, r) => s + r.half_day, 0);
  const totalAbsent = reportData.reduce((s, r) => s + r.absent, 0);
  const totalHoliday = reportData.reduce((s, r) => s + r.holiday, 0);
  const totalUnmarked = reportData.reduce((s, r) => s + r.unmarked, 0);
  const presentEquivalent = totalFullDay + (totalHalfDay * 0.5);
  const workingStudentsTotal = totalStudents - totalHoliday;
  const overallPct = workingStudentsTotal > 0 ? Math.round((presentEquivalent / workingStudentsTotal) * 100) : 0;

  const formatSubmittedTime = (submittedAt) => {
    if (!submittedAt) return 'Not Submitted';
    try { return new Date(submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }); }
    catch { return 'Not Submitted'; }
  };

  // Last 5 days per-student
  const last5ClassSections = useMemo(() => {
    const set = new Set();
    allStudents.forEach(s => set.add(`${s.class_name}||${s.section}`));
    return Array.from(set).map(k => { const [c, sec] = k.split('||'); return { class_name: c, section: sec }; })
      .sort((a, b) => a.class_name.localeCompare(b.class_name) || a.section.localeCompare(b.section));
  }, [allStudents]);

  const last5StudentRows = useMemo(() => {
    if (!showLast5Days) return [];
    const filtered = allStudents.filter(s =>
      (!last5DaysFilter.class_name || s.class_name === last5DaysFilter.class_name) &&
      (!last5DaysFilter.section || s.section === last5DaysFilter.section)
    );
    const attMap = {};
    last5Attendance.forEach(r => { const k = `${r.student_id}__${r.date}`; if (!attMap[k]) attMap[k] = r; });
    return filtered.map(student => ({
      name: student.name,
      class_name: student.class_name,
      section: student.section,
      days: last5Days.map(d => {
        const r = attMap[`${student.student_id}__${d}`];
        if (!r) return 'unmarked';
        return r.attendance_type || 'full_day';
      })
    })).sort((a, b) => a.class_name.localeCompare(b.class_name) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name));
  }, [showLast5Days, last5Attendance, allStudents, last5Days, last5DaysFilter]);

  const statusLabel = (s) => {
    if (s === 'full_day') return { label: 'P', color: 'bg-green-100 text-green-700' };
    if (s === 'half_day') return { label: 'H', color: 'bg-yellow-100 text-yellow-700' };
    if (s === 'absent') return { label: 'A', color: 'bg-red-100 text-red-700' };
    return { label: '—', color: 'bg-slate-100 text-slate-400' };
  };

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowLast5Days(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            !showLast5Days ? 'bg-[#1a237e] text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          Single Day Snapshot
        </button>
        <button
          onClick={() => setShowLast5Days(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-all ${
            showLast5Days ? 'bg-[#1a237e] text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          }`}
        >
          <History className="h-4 w-4" /> Last 5 Days
        </button>
      </div>

      {/* Single Day View */}
      {!showLast5Days && (
        <>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1 max-w-xs">
                  <label className="text-sm font-medium text-slate-700 block mb-1">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    min={academicYearData?.start_date}
                    max={academicYearData?.end_date}
                    disabled={!academicYearData}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#1a237e] disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-slate-400">Full-school snapshot — aggregated across all classes and sections.</p>
              </div>
            </CardContent>
          </Card>

          {isLoadingAttendance ? (
            <Card className="border-0 shadow-sm"><CardContent className="py-12"><LoadingSpinner /></CardContent></Card>
          ) : reportData.length > 0 ? (
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-4 py-3">
                <h3 className="text-white font-semibold">Attendance Snapshot — {selectedDate}</h3>
              </div>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left p-3 font-semibold text-slate-700 min-w-32">Class</th>
                        <th className="text-center p-3 font-semibold text-slate-700 w-20">Total</th>
                        <th className="text-center p-3 font-semibold text-slate-700 w-20">Full Day</th>
                        <th className="text-center p-3 font-semibold text-slate-700 w-20">Half Day</th>
                        <th className="text-center p-3 font-semibold text-slate-700 w-20">Absent</th>
                        <th className="text-center p-3 font-semibold text-slate-700 w-20">Holiday</th>
                        <th className="text-center p-3 font-semibold text-slate-700 w-20">Unmarked</th>
                        <th className="text-center p-3 font-semibold text-slate-700 w-28">Attendance %</th>
                        <th className="text-left p-3 font-semibold text-slate-700 min-w-40">Submitted By</th>
                        <th className="text-left p-3 font-semibold text-slate-700 min-w-36">Submitted Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row) => {
                        const pe = row.full_day + (row.half_day * 0.5);
                        const ws = row.total_students - row.holiday;
                        const pct = ws > 0 ? Math.round((pe / ws) * 100) : 0;
                        return (
                          <tr key={`${row.class_name}-${row.section}`} className="border-b border-slate-100 hover:bg-slate-50">
                            <td className="p-3 font-semibold text-slate-700">Class {row.class_name}{row.section ? `-${row.section}` : ''}</td>
                            <td className="text-center p-3 text-slate-700">{row.total_students}</td>
                            <td className="text-center p-3 text-green-600 font-medium cursor-pointer hover:bg-green-50 rounded" onClick={() => { setSelectedClassData(row); setViewType('full_day'); }}>{row.full_day}</td>
                            <td className="text-center p-3 text-yellow-600 font-medium cursor-pointer hover:bg-yellow-50 rounded" onClick={() => { setSelectedClassData(row); setViewType('half_day'); }}>{row.half_day}</td>
                            <td className="text-center p-3 text-red-600 font-medium cursor-pointer hover:bg-red-50 rounded" onClick={() => { setSelectedClassData(row); setViewType('absent'); }}>{row.absent}</td>
                            <td className="text-center p-3 text-amber-600 font-medium cursor-pointer hover:bg-amber-50 rounded" onClick={() => { setSelectedClassData(row); setViewType('holiday'); }}>{row.holiday}</td>
                            <td className="text-center p-3 text-slate-500 font-medium cursor-pointer hover:bg-slate-100 rounded" onClick={() => { setSelectedClassData(row); setViewType('unmarked'); }}>{row.unmarked}</td>
                            <td className="text-center p-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${pct >= 85 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{pct}%</span>
                            </td>
                            <td className="text-left p-3 text-sm text-slate-700">
                              <span className={`px-2 py-1 rounded-lg text-xs font-medium ${row.submitted_by === 'System Submitted' ? 'bg-blue-100 text-blue-700' : row.submitted_by === 'Not Submitted' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'}`}>{row.submitted_by}</span>
                            </td>
                            <td className="text-left p-3 text-sm text-slate-600">
                              {row.submitted_at ? <span className="text-xs font-medium text-slate-700">{formatSubmittedTime(row.submitted_at)}</span> : <span className="text-xs text-gray-400">Not Submitted</span>}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-slate-100 border-t-2 border-slate-300">
                        <td className="p-3 font-bold text-slate-800">TOTAL</td>
                        <td className="text-center p-3 font-bold text-slate-800">{totalStudents}</td>
                        <td className="text-center p-3 font-bold text-green-700">{totalFullDay}</td>
                        <td className="text-center p-3 font-bold text-yellow-700">{totalHalfDay}</td>
                        <td className="text-center p-3 font-bold text-red-700">{totalAbsent}</td>
                        <td className="text-center p-3 font-bold text-amber-700">{totalHoliday}</td>
                        <td className="text-center p-3 font-bold text-slate-700">{totalUnmarked}</td>
                        <td className="text-center p-3 font-bold"><span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{overallPct}%</span></td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No attendance data</h3>
                <p className="text-slate-500 mt-2">No attendance records found for {selectedDate}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Last 5 Days View */}
      {showLast5Days && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Class</label>
                  <select
                    value={last5DaysFilter.class_name}
                    onChange={e => setLast5DaysFilter(f => ({ ...f, class_name: e.target.value, section: '' }))}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#1a237e]"
                  >
                    <option value="">All Classes</option>
                    {[...new Set(last5ClassSections.map(x => x.class_name))].map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Section</label>
                  <select
                    value={last5DaysFilter.section}
                    onChange={e => setLast5DaysFilter(f => ({ ...f, section: e.target.value }))}
                    className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#1a237e]"
                  >
                    <option value="">All Sections</option>
                    {last5ClassSections
                      .filter(x => !last5DaysFilter.class_name || x.class_name === last5DaysFilter.class_name)
                      .map(x => x.section).filter(Boolean)
                      .filter((v, i, a) => a.indexOf(v) === i)
                      .map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="text-xs text-slate-400 self-end pb-2">P = Present &nbsp;|&nbsp; H = Half Day &nbsp;|&nbsp; A = Absent &nbsp;|&nbsp; — = Unmarked</p>
              </div>
            </CardContent>
          </Card>

          {isLoadingLast5 ? (
            <Card className="border-0 shadow-sm"><CardContent className="py-12"><LoadingSpinner /></CardContent></Card>
          ) : last5StudentRows.length > 0 ? (
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-4 py-3">
                <h3 className="text-white font-semibold">Last 5 Working Days — Student Attendance</h3>
              </div>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="text-left p-3 font-semibold text-slate-700 min-w-40">Student</th>
                        <th className="text-center p-3 font-semibold text-slate-700 min-w-20">Class</th>
                        {last5Days.map(d => (
                          <th key={d} className="text-center p-3 font-semibold text-slate-700 min-w-16">
                            <div className="text-xs">{format(new Date(d + 'T00:00:00'), 'dd MMM')}</div>
                            <div className="text-[10px] text-slate-400">{format(new Date(d + 'T00:00:00'), 'EEE')}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {last5StudentRows.map((row, idx) => (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-medium text-slate-800">{row.name}</td>
                          <td className="text-center p-3 text-slate-500 text-xs">Class {row.class_name}{row.section ? `-${row.section}` : ''}</td>
                          {row.days.map((status, di) => {
                            const { label, color } = statusLabel(status);
                            return (
                              <td key={di} className="text-center p-3">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${color}`}>{label}</span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <History className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No data found</h3>
                <p className="text-slate-500 mt-2">No attendance records for the last 5 working days</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Student Drill-down Dialog */}
      <Dialog open={!!selectedClassData} onOpenChange={(open) => !open && setSelectedClassData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewType === 'full_day' ? 'Full Day' : viewType === 'half_day' ? 'Half Day' : viewType === 'absent' ? 'Absent' : viewType === 'holiday' ? 'Holiday' : 'Unmarked'} Students — Class {selectedClassData?.class_name}{selectedClassData?.section ? `-${selectedClassData.section}` : ''}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(() => {
              let list = [];
              if (viewType === 'full_day') list = selectedClassData?.full_day_students || [];
              else if (viewType === 'half_day') list = selectedClassData?.half_day_students || [];
              else if (viewType === 'absent') list = selectedClassData?.absent_students || [];
              else if (viewType === 'holiday') list = selectedClassData?.holiday_students || [];
              else if (viewType === 'unmarked') list = selectedClassData?.unmarked_students || [];

              if (!list || list.length === 0) return <p className="text-center py-6 text-slate-500">No {viewType} students</p>;

              const bgColorMap = {
                full_day: 'bg-green-50 border-green-200',
                half_day: 'bg-yellow-50 border-yellow-200',
                absent: 'bg-red-50 border-red-200',
                holiday: 'bg-amber-50 border-amber-200',
                unmarked: 'bg-slate-50 border-slate-200'
              };

              return list.map((student, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${bgColorMap[viewType]}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{student.name}</p>
                    <div className="flex items-center gap-1 mt-1 text-sm text-slate-600">
                      <Phone className="h-4 w-4" />
                      <a href={`tel:${student.phone}`} className="hover:underline">{student.phone}</a>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}