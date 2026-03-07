import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Eye, Phone } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function DailySnapshotTab() {
  const { academicYear } = useAcademicYear();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedClassData, setSelectedClassData] = useState(null);
  const [viewType, setViewType] = useState('absent');

  const { data: attendanceData = [] } = useQuery({
    queryKey: ['daily-snapshot-attendance', selectedDate, academicYear],
    queryFn: () => base44.entities.Attendance.filter({ academic_year: academicYear, date: selectedDate }),
    enabled: !!selectedDate
  });

  const { data: allStudents = [] } = useQuery({
    queryKey: ['daily-snapshot-students', academicYear],
    queryFn: () => base44.entities.Student.filter({ academic_year: academicYear, status: 'Published', is_deleted: false })
  });

  const reportData = React.useMemo(() => {
    if (!allStudents.length) return [];

    const classData = {};
    CLASSES.forEach(cls => {
      classData[cls] = { class_name: cls, total_students: 0, present: 0, absent: 0, present_students: [], absent_students: [] };
    });

    allStudents.forEach(student => {
      if (classData[student.class_name]) {
        classData[student.class_name].total_students++;
      }
    });

    const processedStudents = new Set();
    attendanceData.forEach(record => {
      if (!classData[record.class_name]) return;
      const key = `${record.class_name}-${record.student_id}`;
      if (processedStudents.has(key)) return;
      processedStudents.add(key);

      const student = allStudents.find(s => s.student_id === record.student_id);
      if (record.is_present) {
        classData[record.class_name].present++;
        if (student) classData[record.class_name].present_students.push({ name: student.name, phone: student.parent_phone || 'N/A' });
      } else {
        classData[record.class_name].absent++;
        if (student) classData[record.class_name].absent_students.push({ name: student.name, phone: student.parent_phone || 'N/A' });
      }
    });

    return Object.values(classData).filter(c => c.total_students > 0);
  }, [allStudents, attendanceData]);

  const totalStudents = reportData.reduce((s, r) => s + r.total_students, 0);
  const totalPresent = reportData.reduce((s, r) => s + r.present, 0);
  const totalAbsent = reportData.reduce((s, r) => s + r.absent, 0);
  const overallPct = totalStudents > 0 ? Math.round((totalPresent / totalStudents) * 100) : 0;

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
            <p className="text-xs text-slate-400 pb-2">
              Class-level snapshot — aggregated across all sections of each class.
            </p>
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
                      <th className="text-center p-3 font-semibold text-slate-700 w-28">Total</th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-28">Present</th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-28">Absent</th>
                      <th className="text-center p-3 font-semibold text-slate-700 w-28">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row) => {
                      const pct = row.total_students > 0 ? Math.round((row.present / row.total_students) * 100) : 0;
                      return (
                        <tr key={row.class_name} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="p-3 font-semibold text-slate-700">Class {row.class_name}</td>
                          <td className="text-center p-3 text-slate-700">{row.total_students}</td>
                          <td
                            className="text-center p-3 text-green-600 font-medium cursor-pointer hover:bg-green-50 rounded"
                            onClick={() => { setSelectedClassData(row); setViewType('present'); }}
                          >
                            {row.present}
                          </td>
                          <td
                            className="text-center p-3 text-red-600 font-medium cursor-pointer hover:bg-red-50 rounded"
                            onClick={() => { setSelectedClassData(row); setViewType('absent'); }}
                          >
                            {row.absent}
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
                      <td className="text-center p-3 font-bold text-green-700">{totalPresent}</td>
                      <td className="text-center p-3 font-bold text-red-700">{totalAbsent}</td>
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
            <p className="text-slate-500 mt-2">Choose a date to view the class-wise attendance snapshot</p>
          </CardContent>
        </Card>
      )}

      {/* Student Drill-down Dialog */}
      <Dialog open={!!selectedClassData} onOpenChange={(open) => !open && setSelectedClassData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewType === 'absent' ? 'Absent' : 'Present'} Students — Class {selectedClassData?.class_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {(() => {
              const list = viewType === 'absent' ? selectedClassData?.absent_students : selectedClassData?.present_students;
              if (!list || list.length === 0) {
                return <p className="text-center py-6 text-slate-500">No {viewType} students</p>;
              }
              return list.map((student, idx) => (
                <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border ${viewType === 'absent' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800">{student.name}</p>
                    <div className={`flex items-center gap-1 mt-1 text-sm ${viewType === 'absent' ? 'text-red-600' : 'text-green-600'}`}>
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