import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Phone } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getDay } from 'date-fns';

export default function DailySnapshotTab() {
  const { academicYear } = useAcademicYear();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedClassData, setSelectedClassData] = useState(null);
  const [viewType, setViewType] = useState('full_day');

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
  const { data: attendanceData = [] } = useQuery({
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

    // Build classMap from actual students
    const classMap = {};

    allStudents.forEach(student => {
      const cls = student.class_name;
      if (!classMap[cls]) {
        classMap[cls] = {
          class_name: cls,
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
          unmarked_students: []
        };
      }
      classMap[cls].total_students++;
    });

    // Build attendance record map for fast lookup
    const attendanceMap = {};
    attendanceData.forEach(record => {
      const key = `${record.class_name}-${record.student_id}`;
      if (!attendanceMap[key]) {
        attendanceMap[key] = record;
      }
    });

    // Process each student: determine effectiveHoliday first, then classify
    allStudents.forEach(student => {
      const cls = student.class_name;
      if (!classMap[cls]) return;

      const studentInfo = { name: student.name, phone: student.parent_phone || 'N/A' };
      const effectiveHoliday = isStudentHoliday(student);

      if (effectiveHoliday) {
        classMap[cls].holiday++;
        classMap[cls].holiday_students.push(studentInfo);
      } else {
        // Check for attendance record
        const recordKey = `${cls}-${student.student_id}`;
        const record = attendanceMap[recordKey];

        if (record) {
          const attType = record.attendance_type || 'full_day';
          if (attType === 'full_day') {
            classMap[cls].full_day++;
            classMap[cls].full_day_students.push(studentInfo);
          } else if (attType === 'half_day') {
            classMap[cls].half_day++;
            classMap[cls].half_day_students.push(studentInfo);
          } else if (attType === 'absent') {
            classMap[cls].absent++;
            classMap[cls].absent_students.push(studentInfo);
          }
        } else {
          // No attendance record and not a holiday
          classMap[cls].unmarked++;
          classMap[cls].unmarked_students.push(studentInfo);
        }
      }
    });

    return Object.values(classMap);
  }, [selectedDate, allStudents, attendanceData, holidays, overrides]);

  const totalStudents = reportData.reduce((s, r) => s + r.total_students, 0);
  const totalFullDay = reportData.reduce((s, r) => s + r.full_day, 0);
  const totalHalfDay = reportData.reduce((s, r) => s + r.half_day, 0);
  const totalAbsent = reportData.reduce((s, r) => s + r.absent, 0);
  const totalHoliday = reportData.reduce((s, r) => s + r.holiday, 0);
  const totalUnmarked = reportData.reduce((s, r) => s + r.unmarked, 0);

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
                className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-[#1a237e]"
              />
            </div>
            <p className="text-xs text-slate-400">Full-school snapshot — aggregated across all classes and sections.</p>
          </div>
        </CardContent>
      </Card>

      {/* Report Table */}
      {selectedDate ? (
        reportData.length > 0 ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row) => {
                      const presentEquivalent = row.full_day + (row.half_day * 0.5);
                      const workingStudents = row.total_students - row.holiday;
                      const pct = workingStudents > 0 ? Math.round((presentEquivalent / workingStudents) * 100) : 0;
                      return (
                        <tr key={row.class_name} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-700">Class {row.class_name}</td>
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
              {viewType === 'full_day' ? 'Full Day' : viewType === 'half_day' ? 'Half Day' : viewType === 'absent' ? 'Absent' : viewType === 'holiday' ? 'Holiday' : 'Unmarked'} Students — Class {selectedClassData?.class_name}
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
    </div>
  );
}