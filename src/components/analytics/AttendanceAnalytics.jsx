import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const COLORS = ['#10b981', '#ef4444', '#f59e0b'];

export default function AttendanceAnalytics({ classFilter, academicYear }) {
  const { data: attendanceData = [] } = useQuery({
    queryKey: ['attendance', classFilter, academicYear],
    queryFn: async () => {
      let filter = { academic_year: academicYear };
      if (classFilter !== 'all') filter.class_name = classFilter;
      return base44.entities.Attendance.filter(filter);
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students', classFilter],
    queryFn: async () => {
      let filter = {};
      if (classFilter !== 'all') filter.class_name = classFilter;
      return base44.entities.Student.filter(filter);
    },
  });

  // Calculate class-wise attendance
  const classAttendance = useMemo(() => {
    const classMap = {};
    attendanceData.forEach(record => {
      if (!classMap[record.class_name]) {
        classMap[record.class_name] = { present: 0, absent: 0, total: 0 };
      }
      classMap[record.class_name].total++;
      if (record.is_present) classMap[record.class_name].present++;
      else classMap[record.class_name].absent++;
    });

    return Object.entries(classMap).map(([name, data]) => ({
      name,
      percentage: ((data.present / data.total) * 100).toFixed(1),
      present: data.present,
      absent: data.absent,
    }));
  }, [attendanceData]);

  // Overall attendance summary
  const overallStats = useMemo(() => {
    const total = attendanceData.length;
    const present = attendanceData.filter(a => a.is_present).length;
    return {
      present,
      absent: total - present,
      percentage: total > 0 ? ((present / total) * 100).toFixed(1) : 0,
    };
  }, [attendanceData]);

  // Student-wise attendance
  const studentAttendance = useMemo(() => {
    const studentMap = {};
    attendanceData.forEach(record => {
      if (!studentMap[record.student_id]) {
        studentMap[record.student_id] = {
          name: record.student_name,
          present: 0,
          total: 0,
        };
      }
      studentMap[record.student_id].total++;
      if (record.is_present) studentMap[record.student_id].present++;
    });

    return Object.values(studentMap)
      .map(s => ({
        ...s,
        percentage: ((s.present / s.total) * 100).toFixed(1),
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10);
  }, [attendanceData]);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Present</p>
            <p className="text-2xl font-bold text-green-600">{overallStats.present}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Absent</p>
            <p className="text-2xl font-bold text-red-600">{overallStats.absent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Percentage</p>
            <p className="text-2xl font-bold text-blue-600">{overallStats.percentage}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Class-wise Attendance Chart */}
      {classAttendance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Attendance by Class</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={classAttendance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.1)' }} />
                <Bar dataKey="present" fill="#10b981" />
                <Bar dataKey="absent" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Attendance Percentage Pie */}
      {overallStats.present > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall Attendance Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Present', value: overallStats.present },
                    { name: 'Absent', value: overallStats.absent },
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#ef4444" />
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top Attendees */}
      {studentAttendance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 10 Students (Attendance)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {studentAttendance.map((student, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{student.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${student.percentage}%` }}
                      />
                    </div>
                    <span className="font-semibold w-12 text-right">{student.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}