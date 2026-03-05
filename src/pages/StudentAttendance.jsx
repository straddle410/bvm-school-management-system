import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Calendar, AlertCircle } from 'lucide-react';
import { createPageUrl } from '@/utils';

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function StudentAttendance() {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) {
      window.location.href = createPageUrl('StudentLogin');
      return;
    }
    setStudent(session);
    setLoading(false);
  }, []);

  const { data: attendanceData = {} } = useQuery({
    queryKey: ['student-attendance', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return {};
      try {
        const res = await base44.functions.invoke('calculateAttendanceSummaryForStudent', {
          student_id: student.student_id,
          academic_year: student.academic_year,
        });
        return res.data || {};
      } catch {
        return {};
      }
    },
    enabled: !!student?.student_id,
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance-records', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return [];
      try {
        const records = await base44.entities.Attendance.filter({
          student_id: student.student_id,
          academic_year: student.academic_year,
        }, '-attendance_date', 1000);
        return records || [];
      } catch {
        return [];
      }
    },
    enabled: !!student?.student_id,
  });

  if (!student) return null;

  const attendancePct = Math.round(attendanceData.attendance_percentage || 0);
  const isAbsentToday = attendanceRecords.length > 0 && attendanceRecords[0].status === 'Absent';

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">My Attendance</h1>
        <p className="text-sm text-blue-100">View your attendance record</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Summary Card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider">Overall Attendance</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{attendancePct}%</p>
            </div>
            <div className={`text-sm font-bold px-3 py-1 rounded-full ${
              attendancePct >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}>
              {attendancePct >= 75 ? '✓ Good' : '⚠ Low'}
            </div>
          </div>
          <div className="bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${attendancePct >= 75 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(attendancePct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {attendanceData.present_days || 0} Present / {attendanceData.total_days || 0} Total
          </p>
        </div>

        {/* Info Alert */}
        {attendancePct < 75 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex gap-2">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-700">
              <p className="font-semibold">Low Attendance</p>
              <p className="text-xs mt-0.5">Please maintain at least 75% attendance to be eligible for exams.</p>
            </div>
          </div>
        )}

        {/* Records */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-bold text-gray-700">Attendance Records</p>
          </div>
          {attendanceRecords.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <Calendar className="h-10 w-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No attendance records yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
              {attendanceRecords.map((record) => (
                <div key={record.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {format(new Date(record.attendance_date + 'T00:00:00'), 'MMM d, yyyy')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(record.attendance_date + 'T00:00:00'), 'EEEE')}
                    </p>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    record.status === 'Present' ? 'bg-green-100 text-green-700' :
                    record.status === 'Absent' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {record.status || 'N/A'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}