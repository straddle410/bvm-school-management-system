import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Phone } from 'lucide-react';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

export default function AttendanceReport() {
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedClassAbsent, setSelectedClassAbsent] = useState(null);

  useEffect(() => {
    const staffUser = getStaffSession();
    setIsAdmin(staffUser?.role === 'Admin' || staffUser?.role === 'admin');
  }, []);

  // Fetch attendance data
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance-report', selectedDate],
    queryFn: async () => {
      const filter = {};
      if (selectedDate) filter.date = selectedDate;
      return base44.entities.Attendance.filter(filter);
    },
    enabled: !!selectedDate
  });

  // Fetch all students
  const { data: allStudents = [] } = useQuery({
    queryKey: ['students-all'],
    queryFn: () => base44.entities.Student.list()
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
        absent: 0
      };
    });

    // Count students per class
    allStudents.forEach(student => {
      if (classData[student.class_name]) {
        classData[student.class_name].total_students++;
      }
    });

    // Count attendance
    attendanceData.forEach(record => {
      if (classData[record.class_name]) {
        if (record.is_present) {
          classData[record.class_name].present++;
        } else {
          classData[record.class_name].absent++;
        }
      }
    });

    return Object.values(classData).filter(c => c.total_students > 0);
  }, [allStudents, attendanceData]);

  if (!isAdmin) {
    return (
      <LoginRequired allowedRoles={['admin']} pageName="Attendance Report">
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-700">Access Denied</h2>
            <p className="text-slate-500 mt-2">Only admins can access this page</p>
          </div>
        </div>
      </LoginRequired>
    );
  }

  return (
    <LoginRequired allowedRoles={['admin']} pageName="Attendance Report">
      <div className="min-h-screen bg-slate-50">
        <PageHeader 
          title="Attendance Report"
          subtitle="View daily attendance class-wise"
        />

        <div className="p-4 lg:p-8 space-y-6">
          {/* Date Filter */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-2">Select Date</label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-[#1a237e]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Report */}
          {selectedDate ? (
            reportData.length > 0 ? (
              <div className="space-y-4">
                <Card className="border-0 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-4 py-3">
                    <h3 className="text-white font-semibold">Attendance Summary - {selectedDate}</h3>
                  </div>
                  <CardContent className="p-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-left p-3 font-semibold text-slate-700 min-w-32">Class</th>
                            <th className="text-center p-3 font-semibold text-slate-700 w-24">Total Students</th>
                            <th className="text-center p-3 font-semibold text-slate-700 w-24">Present</th>
                            <th className="text-center p-3 font-semibold text-slate-700 w-24">Absent</th>
                            <th className="text-center p-3 font-semibold text-slate-700 w-24">Attendance %</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.map((row) => {
                            const attendancePercent = row.total_students > 0 
                              ? Math.round((row.present / row.total_students) * 100)
                              : 0;
                            return (
                              <tr key={row.class_name} className="border-b border-slate-100 hover:bg-slate-50">
                                <td className="p-3 font-semibold text-slate-700">Class {row.class_name}</td>
                                <td className="text-center p-3 text-slate-700">{row.total_students}</td>
                                <td className="text-center p-3 text-green-600 font-medium">{row.present}</td>
                                <td className="text-center p-3 text-red-600 font-medium">{row.absent}</td>
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
                          <tr className="bg-slate-100 border-t-2 border-slate-300">
                            <td className="p-3 font-bold text-slate-800">TOTAL</td>
                            <td className="text-center p-3 font-bold text-slate-800">
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
              </div>
            ) : (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">No attendance data</h3>
                  <p className="text-slate-500 mt-2">No attendance records for this date</p>
                </CardContent>
              </Card>
            )
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">Select a Date</h3>
                <p className="text-slate-500 mt-2">Choose a date to view attendance report</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </LoginRequired>
  );
}