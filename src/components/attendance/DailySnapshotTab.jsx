import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Phone, History } from 'lucide-react';
import { format } from 'date-fns';

const LoadingSpinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
  </div>
);
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getDay } from 'date-fns';
import { deduplicateAttendanceRecords } from '@/components/attendanceCalculations';

export default function DailySnapshotTab() {
  const { academicYear } = useAcademicYear();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClassData, setSelectedClassData] = useState(null);
  const [viewType, setViewType] = useState('full_day');
  const [academicYearData, setAcademicYearData] = useState(null);
  const [last5Modal, setLast5Modal] = useState(null); // {class_name, section, students}
  const [last5Attendance, setLast5Attendance] = useState({});
  const [isLoadingLast5, setIsLoadingLast5] = useState(false);

  // Fetch academic year data for date constraints
  useEffect(() => {
    const fetchAcademicYear = async () => {
      try {
        const data = await base44.entities.AcademicYear.filter({ year: academicYear });
        if (data.length > 0) {
          setAcademicYearData(data[0]);
        }
      } catch (err) {
        console.error('Failed to fetch academic year:', err);
      }
    };
    if (academicYear) fetchAcademicYear();
  }, [academicYear]);

  // Fetch all active students for the year
  const { data: allStudents = [] } = useQuery({
    queryKey: ['daily-snapshot-students', academicYear],
    queryFn: () => base44.entities.Student.filter({
      academic_year: academicYear,
      status: 'Published',
      is_deleted: false
    })
  });

  // Fetch attendance records for selected date
  const { data: attendanceData = [], isLoading: isLoadingAttendance } = useQuery({
    queryKey: ['daily-snapshot-attendance', selectedDate, academicYear],
    queryFn: () => base44.entities.Attendance.filter({
      academic_year: academicYear,
      date: selectedDate
    }),
    enabled: !!selectedDate
  });

  // Fetch holidays for selected date
  const { data: holidays = [] } = useQuery({
    queryKey: ['daily-snapshot-holidays', selectedDate, academicYear],
    queryFn: () => base44.entities.Holiday.filter({
      academic_year: academicYear,
      date: selectedDate,
      status: 'Active'
    }),
    enabled: !!selectedDate
  });

  // Fetch holiday overrides for selected date
  const { data: overrides = [] } = useQuery({
    queryKey: ['daily-snapshot-overrides', selectedDate, academicYear],
    queryFn: () => base44.entities.HolidayOverride.filter({
      academic_year: academicYear,
      date: selectedDate
    }),
    enabled: !!selectedDate
  });

  const { data: staffAccounts = [] } = useQuery({
    queryKey: ['staff-accounts', academicYear],
    queryFn: () => base44.entities.StaffAccount.list(),
    staleTime: 10 * 60 * 1000
  });

  // Build staff name lookup from marked_by email
  const staffNameMap = useMemo(() => {
    const map = {};
    staffAccounts.forEach(staff => {
      if (staff.email) {
        map[staff.email] = staff.name;
      }
    });
    return map;
  }, [staffAccounts]);

  const reportData = useMemo(() => {
    if (!selectedDate || !allStudents.length) return [];

    // Check if selectedDate is Sunday
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const isSunday = getDay(dateObj) === 0;

    // Check if there's a global holiday marked
    const isMarkedHoliday = holidays.length > 0;

    // Build override map: class_name-section -> true
    const overrideMap = {};
    overrides.forEach(o => {
      overrideMap[`${o.class_name}-${o.section}`] = true;
    });

    // Helper: determine if a student has a holiday for selectedDate
    const isStudentHoliday = (student) => {
      const overrideKey = `${student.class_name}-${student.section}`;
      const hasOverrideForClassSection = !!overrideMap[overrideKey];

      // If override exists for this class/section, not a holiday
      if (hasOverrideForClassSection) return false;

      // Check: Sunday or marked holiday = holiday
      return isSunday || isMarkedHoliday;
    };

    // Build groupMap keyed by class_name + section
    const groupMap = {};

    allStudents.forEach(student => {
      const key = `${student.class_name}__${student.section}`;
      if (!groupMap[key]) {
        groupMap[key] = {
          class_name: student.class_name,
          section: student.section,
          total_students: 0,
          full_day: 0,
          half_day: 0,
          absent: 0,
          holiday: 0,
          unmarked: 0,
          full_day_students: [],
          half_day_students: [],
          absent_students: [],
          holiday_students: [],
          unmarked_students: [],
          submitted_by: 'Not Submitted',
          submitted_at: null
        };
      }
      groupMap[key].total_students++;
    });

    // CANONICAL DEDUPLICATION: deduplicate before building map
    const dedupedAttendance = deduplicateAttendanceRecords(attendanceData);

    // Build attendance record map for fast lookup keyed by class+section+student
    const attendanceMap = {};
    dedupedAttendance.forEach(record => {
      const key = `${record.class_name}__${record.section}__${record.student_id}`;
      if (!attendanceMap[key]) {
        attendanceMap[key] = record;
      }
    });

    // Determine submitted_by and submitted_at per class+section group
    // ONLY consider records with status === "Submitted"
    const groupSubmissionMap = {};

    // Group all records by class+section first
    const recordsByGroup = {};
    dedupedAttendance.forEach(record => {
      const key = `${record.class_name}__${record.section}`;
      if (!recordsByGroup[key]) recordsByGroup[key] = [];
      recordsByGroup[key].push(record);
    });

    Object.entries(recordsByGroup).forEach(([key, groupRecords]) => {
      // Only look at Submitted records (including auto-submitted)
      const validRecords = groupRecords.filter(r => r.status === 'Submitted');

      // Pick the latest record (prefer one with submitted_at, fallback to any Submitted record)
      let latestRecord = validRecords
        .filter(r => r.submitted_at)
        .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))[0];

      // If no record with submitted_at found, use any Submitted record (e.g., auto-submitted)
      if (!latestRecord && validRecords.length > 0) {
        latestRecord = validRecords[0];
      }

      let submittedBy = 'Not Submitted';
      let submittedAt = null;

      if (latestRecord) {
        submittedAt = latestRecord.submitted_at;
        if (latestRecord.auto_submitted || latestRecord.marked_by === 'SYSTEM') {
          submittedBy = 'System Submitted';
        } else if (latestRecord.marked_by) {
          submittedBy = staffNameMap[latestRecord.marked_by] || latestRecord.marked_by;
        }
      }

      groupSubmissionMap[key] = { submitted_by: submittedBy, submitted_at: submittedAt };
    });

    // Process each student: determine effectiveHoliday first, then classify
    allStudents.forEach(student => {
      const key = `${student.class_name}__${student.section}`;
      if (!groupMap[key]) return;

      const studentInfo = { name: student.name, phone: student.parent_phone || 'N/A' };
      const effectiveHoliday = isStudentHoliday(student);

      if (effectiveHoliday) {
        groupMap[key].holiday++;
        groupMap[key].holiday_students.push(studentInfo);
      } else {
        const recordKey = `${student.class_name}__${student.section}__${student.student_id}`;
        const record = attendanceMap[recordKey];

        if (record) {
          const attType = record.attendance_type || 'full_day';
          if (attType === 'full_day') {
            groupMap[key].full_day++;
            groupMap[key].full_day_students.push(studentInfo);
          } else if (attType === 'half_day') {
            groupMap[key].half_day++;
            groupMap[key].half_day_students.push(studentInfo);
          } else if (attType === 'absent') {
            groupMap[key].absent++;
            groupMap[key].absent_students.push(studentInfo);
          }
        } else {
          groupMap[key].unmarked++;
          groupMap[key].unmarked_students.push(studentInfo);
        }
      }
    });

    // Apply submission info to each group
    Object.keys(groupMap).forEach(key => {
      const sub = groupSubmissionMap[key];
      if (sub) {
        groupMap[key].submitted_by = sub.submitted_by;
        groupMap[key].submitted_at = sub.submitted_at;
      }
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

  // Compute last 5 non-Sunday dates from selectedDate (inclusive, descending)
  const last5Dates = useMemo(() => {
    if (!selectedDate) return [];
    const dates = [];
    const current = new Date(selectedDate + 'T00:00:00');
    while (dates.length < 5) {
      if (getDay(current) !== 0) dates.push(format(current, 'yyyy-MM-dd'));
      current.setDate(current.getDate() - 1);
    }
    return dates; // descending (newest first)
  }, [selectedDate]);

  // Fetch last 5 days attendance when modal opens
  useEffect(() => {
    if (!last5Modal || last5Dates.length === 0) return;
    setIsLoadingLast5(true);
    setLast5Attendance({});
    Promise.all(
      last5Dates.map(date =>
        base44.entities.Attendance.filter({
          academic_year: academicYear,
          class_name: last5Modal.class_name,
          section: last5Modal.section,
          date
        })
      )
    ).then(results => {
      const map = {};
      last5Dates.forEach((date, i) => {
        map[date] = {};
        results[i].forEach(rec => {
          map[date][rec.student_id] = rec.attendance_type || 'full_day';
        });
      });
      setLast5Attendance(map);
      setIsLoadingLast5(false);
    }).catch(() => setIsLoadingLast5(false));
  }, [last5Modal, last5Dates, academicYear]);

  const formatSubmittedTime = (submittedAt) => {
    if (!submittedAt) return 'Not Submitted';
    try {
      return new Date(submittedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return 'Not Submitted';
    }
  };

  const presentEquivalent = totalFullDay + (totalHalfDay * 0.5);
  const workingStudentsTotal = totalStudents - totalHoliday;
  const overallPct = workingStudentsTotal > 0 ? Math.round((presentEquivalent / workingStudentsTotal) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Date Picker */}
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

      {/* Report Table */}
      {selectedDate ? (
        isLoadingAttendance ? (
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
                      <th className="text-center p-3 font-semibold text-slate-700 w-24">Last 5 Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row) => {
                      const presentEquivalent = row.full_day + (row.half_day * 0.5);
                      const workingStudents = row.total_students - row.holiday;
                      const pct = workingStudents > 0 ? Math.round((presentEquivalent / workingStudents) * 100) : 0;
                      return (
                        <tr key={`${row.class_name}-${row.section}`} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-700">Class {row.class_name}{row.section ? `-${row.section}` : ''}</td>
                          <td className="text-center p-3 text-slate-700">{row.total_students}</td>
                          <td
                            className="text-center p-3 text-green-600 font-medium cursor-pointer hover:bg-green-50 rounded"
                            onClick={() => { setSelectedClassData(row); setViewType('full_day'); }}
                          >
                            {row.full_day}
                          </td>
                          <td
                            className="text-center p-3 text-yellow-600 font-medium cursor-pointer hover:bg-yellow-50 rounded"
                            onClick={() => { setSelectedClassData(row); setViewType('half_day'); }}
                          >
                            {row.half_day}
                          </td>
                          <td
                            className="text-center p-3 text-red-600 font-medium cursor-pointer hover:bg-red-50 rounded"
                            onClick={() => { setSelectedClassData(row); setViewType('absent'); }}
                          >
                            {row.absent}
                          </td>
                          <td
                            className="text-center p-3 text-amber-600 font-medium cursor-pointer hover:bg-amber-50 rounded"
                            onClick={() => { setSelectedClassData(row); setViewType('holiday'); }}
                          >
                            {row.holiday}
                          </td>
                          <td
                            className="text-center p-3 text-slate-500 font-medium cursor-pointer hover:bg-slate-100 rounded"
                            onClick={() => { setSelectedClassData(row); setViewType('unmarked'); }}
                          >
                            {row.unmarked}
                          </td>
                          <td className="text-center p-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${pct >= 85 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                              {pct}%
                            </span>
                          </td>
                          <td className="text-left p-3 text-sm text-slate-700">
                            <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
                              row.submitted_by === 'System Submitted' ? 'bg-blue-100 text-blue-700' :
                              row.submitted_by === 'Not Submitted' ? 'bg-gray-100 text-gray-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {row.submitted_by}
                            </span>
                          </td>
                          <td className="text-left p-3 text-sm text-slate-600">
                            {row.submitted_at ? (
                              <span className="text-xs font-medium text-slate-700">
                                {formatSubmittedTime(row.submitted_at)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Not Submitted</span>
                            )}
                          </td>
                          <td className="text-center p-3">
                            <button
                              onClick={() => {
                                const classStudents = allStudents.filter(
                                  s => s.class_name === row.class_name && s.section === row.section
                                );
                                setLast5Modal({ class_name: row.class_name, section: row.section, students: classStudents });
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition text-xs font-medium"
                            >
                              <History className="h-3.5 w-3.5" />
                              View
                            </button>
                          </td>
                          </tr>
                          );
                    })}
                    {/* Totals row */}
                    <tr className="bg-slate-100 border-t-2 border-slate-300">
                      <td className="p-3 font-bold text-slate-800">TOTAL</td>
                      <td className="text-center p-3 font-bold text-slate-800">{totalStudents}</td>
                      <td className="text-center p-3 font-bold text-green-700">{totalFullDay}</td>
                      <td className="text-center p-3 font-bold text-yellow-700">{totalHalfDay}</td>
                      <td className="text-center p-3 font-bold text-red-700">{totalAbsent}</td>
                      <td className="text-center p-3 font-bold text-amber-700">{totalHoliday}</td>
                      <td className="text-center p-3 font-bold text-slate-700">{totalUnmarked}</td>
                      <td className="text-center p-3 font-bold">
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">{overallPct}%</span>
                      </td>
                      <td className="p-3"></td>
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
        )
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700">Select a Date</h3>
            <p className="text-slate-500 mt-2">Choose a date to view full-school attendance snapshot</p>
          </CardContent>
        </Card>
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

              if (!list || list.length === 0) {
                return <p className="text-center py-6 text-slate-500">No {viewType} students</p>;
              }

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

      {/* Last 5 Days Dialog */}
      <Dialog open={!!last5Modal} onOpenChange={(open) => !open && setLast5Modal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Last 5 Working Days — Class {last5Modal?.class_name}{last5Modal?.section ? `-${last5Modal.section}` : ''}
            </DialogTitle>
          </DialogHeader>
          {isLoadingLast5 ? (
            <div className="flex justify-center py-8"><div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="border-b border-slate-200">
                    <th className="text-left p-2 font-semibold text-slate-700 min-w-40">Student</th>
                    {last5Dates.map(date => (
                      <th key={date} className="text-center p-2 font-semibold text-slate-700 min-w-20">
                        <div className="text-xs">{format(new Date(date + 'T00:00:00'), 'dd MMM')}</div>
                        <div className="text-[10px] text-slate-400">{format(new Date(date + 'T00:00:00'), 'EEE')}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(last5Modal?.students || []).map((student, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-2 font-medium text-slate-800">{student.name}</td>
                      {last5Dates.map(date => {
                        const status = last5Attendance[date]?.[student.student_id];
                        const noRecord = last5Attendance[date] !== undefined && status === undefined;
                        const label = !status ? (noRecord ? 'U' : '…') : status === 'full_day' ? 'P' : status === 'half_day' ? 'H' : status === 'absent' ? 'A' : status === 'holiday' ? '–' : 'U';
                        const color = !status ? (noRecord ? 'bg-slate-100 text-slate-500' : 'text-slate-400') : status === 'full_day' ? 'bg-green-100 text-green-700' : status === 'half_day' ? 'bg-yellow-100 text-yellow-700' : status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';
                        return (
                          <td key={date} className="text-center p-2">
                            <span className={`inline-block w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${color}`}>{label}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex gap-3 flex-wrap pt-3 px-2 text-xs text-slate-500">
                <span><span className="inline-block w-4 h-4 rounded-full bg-green-100 text-green-700 text-center font-bold">P</span> Present</span>
                <span><span className="inline-block w-4 h-4 rounded-full bg-yellow-100 text-yellow-700 text-center font-bold">H</span> Half Day</span>
                <span><span className="inline-block w-4 h-4 rounded-full bg-red-100 text-red-700 text-center font-bold">A</span> Absent</span>
                <span><span className="inline-block w-4 h-4 rounded-full bg-slate-100 text-slate-500 text-center font-bold">U</span> Unmarked</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}