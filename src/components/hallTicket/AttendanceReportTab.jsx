import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Phone } from 'lucide-react';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function AttendanceReportTab() {
  const { academicYear } = useAcademicYear();
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedClassData, setSelectedClassData] = useState(null);
  const [viewType, setViewType] = useState('absent');

  // Fetch attendance data
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance-report', selectedDate, academicYear],
    queryFn: async () => {
      const filter = { academic_year: academicYear };
      if (selectedDate) filter.date = selectedDate;
      return base44.entities.Attendance.filter(filter);
    },
    enabled: !!selectedDate
  });

  // Fetch all students for this academic year
  const { data: allStudents = [] } = useQuery({
    queryKey: ['students-all', academicYear],
    queryFn: async () => {
      try {
        return await base44.entities.Student.filter({ academic_year: academicYear });
      } catch (error) {
        console.error('Error fetching students:', error);
        return [];
      }
    }
  });

  // Process attendance data
  const reportData = React.useMemo(() => {
    if (!allStudents.length) return [];

    const classData = {};
    
    // Initialize all classes
    CLASSES.forEach(cls => {
      classData[cls] = {
        class_name: cls,
        total_students: 0,
        present: 0,
        absent: 0,
        absent_students: []
      };
    });

    // Count students per class
    allStudents.forEach(student => {
      if (classData[student.class_name]) {
        classData[student.class_name].total_students++;
      }
    });

    // Count attendance - track processed students to avoid duplicates
    const processedStudents = new Set();
    attendanceData.forEach(record => {
      if (classData[record.class_name]) {
        const key = `${record.class_name}-${record.student_id}`;
        // Skip if already processed for this class and student
        if (processedStudents.has(key)) return;
        processedStudents.add(key);
        
        const student = allStudents.find(s => s.student_id === record.student_id);
        if (record.is_present) {
          classData[record.class_name].present++;
          if (student) {
            classData[record.class_name].present_students = classData[record.class_name].present_students || [];
            classData[record.class_name].present_students.push({
              name: student.name,
              phone: student.parent_phone || 'N/A'
            });
          }
        } else {
          classData[record.class_name].absent++;
          if (student) {
            classData[record.class_name].absent_students = classData[record.class_name].absent_students || [];
            classData[record.class_name].absent_students.push({
              name: student.name,
              phone: student.parent_phone || 'N/A'
            });
          }
        }
      }
    });

    return Object.values(classData).filter(c => c.total_students > 0);
  }, [allStudents, attendanceData]);

  return (
    <div className="space-y-4">
      {/* Date Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Select Date</CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600"
          />
        </CardContent>
      </Card>

      {/* Report */}
      {selectedDate ? (
        reportData.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Attendance Summary - {selectedDate}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left p-3 font-semibold text-gray-700">Class</th>
                      <th className="text-center p-3 font-semibold text-gray-700">Total</th>
                      <th className="text-center p-3 font-semibold text-gray-700">Present</th>
                      <th className="text-center p-3 font-semibold text-gray-700">Absent</th>
                      <th className="text-center p-3 font-semibold text-gray-700">Attendance %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row) => {
                      const attendancePercent = row.total_students > 0 
                        ? Math.round((row.present / row.total_students) * 100)
                        : 0;
                      return (
                        <tr key={row.class_name} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-3 font-semibold text-gray-700">Class {row.class_name}</td>
                          <td className="text-center p-3 text-gray-700">{row.total_students}</td>
                          <td 
                            onClick={() => {
                              setSelectedClassData(row);
                              setViewType('present');
                            }}
                            className="text-center p-3 text-green-600 font-medium cursor-pointer hover:bg-green-50 rounded"
                          >
                            {row.present}
                          </td>
                          <td 
                            onClick={() => {
                              setSelectedClassData(row);
                              setViewType('absent');
                            }}
                            className="text-center p-3 text-red-600 font-medium cursor-pointer hover:bg-red-50 rounded"
                          >
                            {row.absent}
                          </td>
                          <td className="text-center p-3 font-semibold">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              attendancePercent >= 85 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {attendancePercent}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr className="bg-gray-100 border-t-2 border-gray-300">
                      <td className="p-3 font-bold text-gray-800">TOTAL</td>
                      <td className="text-center p-3 font-bold text-gray-800">
                        {reportData.reduce((sum, row) => sum + row.total_students, 0)}
                      </td>
                      <td className="text-center p-3 font-bold text-green-700">
                        {reportData.reduce((sum, row) => sum + row.present, 0)}
                      </td>
                      <td className="text-center p-3 font-bold text-red-700">
                        {reportData.reduce((sum, row) => sum + row.absent, 0)}
                      </td>
                      <td className="text-center p-3 font-bold">
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-700">
                          {reportData.length > 0 && reportData.reduce((sum, r) => sum + r.total_students, 0) > 0
                            ? Math.round((reportData.reduce((sum, r) => sum + r.present, 0) / reportData.reduce((sum, r) => sum + r.total_students, 0)) * 100)
                            : 0}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <Eye className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-700">No attendance data</h3>
              <p className="text-gray-500 mt-2">No attendance records for this date</p>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="py-16 text-center">
            <Eye className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700">Select a Date</h3>
            <p className="text-gray-500 mt-2">Choose a date to view attendance report</p>
          </CardContent>
        </Card>
      )}

      {/* Students Dialog */}
      <Dialog open={!!selectedClassData} onOpenChange={(open) => !open && setSelectedClassData(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {viewType === 'absent' ? 'Absent Students' : 'Present Students'} - Class {selectedClassData?.class_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {viewType === 'absent' ? (
              selectedClassData?.absent_students && selectedClassData.absent_students.length > 0 ? (
                selectedClassData.absent_students.map((student, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{student.name}</p>
                      <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${student.phone}`} className="hover:underline">{student.phone}</a>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No absent students</p>
                </div>
              )
            ) : (
              selectedClassData?.present_students && selectedClassData.present_students.length > 0 ? (
                selectedClassData.present_students.map((student, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800">{student.name}</p>
                      <div className="flex items-center gap-1 mt-1 text-green-600 text-sm">
                        <Phone className="h-4 w-4" />
                        <a href={`tel:${student.phone}`} className="hover:underline">{student.phone}</a>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 text-gray-500">
                  <p>No present students</p>
                </div>
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}