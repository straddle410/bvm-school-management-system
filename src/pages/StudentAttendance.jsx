import React, { useState, useEffect } from 'react'; // useState kept for session init
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, BarChart3, ArrowLeft } from 'lucide-react';

export default function StudentAttendance() {
  console.log('[ENTRY] StudentAttendance:', window.location.pathname);
  console.log('[SESSION] localStorage:', localStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');
  console.log('[SESSION] sessionStorage:', sessionStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');

  const navigate = useNavigate();
  const [session] = useState(() => {
    try { const s = localStorage.getItem('student_session'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  useEffect(() => {
    if (!session) navigate(createPageUrl('StudentLogin'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: attendanceData = {}, isLoading } = useQuery({
    queryKey: ['student-attendance', session?.student_id],
    queryFn: async () => {
      if (!session?.student_id) return {};
      try {
        const res = await base44.functions.invoke('calculateAttendanceSummaryForStudent', {
          student_id: session.student_id,
          academic_year: session.academic_year
        });
        return res.data || {};
      } catch {
        return {};
      }
    },
    enabled: !!session?.student_id,
    staleTime: 5 * 60 * 1000,
  });

  if (!session) return null;

  const { total_days = 0, present_days = 0, absent_days = 0, percentage = 0 } = attendanceData;
  const isLowAttendance = percentage < 75;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">My Attendance</h1>
        <p className="text-sm text-blue-100">{session.class_name}-{session.section}</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary Card */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <div className="text-center mb-4">
                <div className={`text-4xl font-bold ${isLowAttendance ? 'text-red-600' : 'text-green-600'}`}>
                  {percentage.toFixed(1)}%
                </div>
                <p className="text-sm text-gray-600 mt-1">Overall Attendance</p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center text-sm">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="font-bold text-blue-900">{total_days}</p>
                  <p className="text-xs text-gray-600">Total Days</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="font-bold text-green-900">{present_days}</p>
                  <p className="text-xs text-gray-600">Present</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="font-bold text-red-900">{absent_days}</p>
                  <p className="text-xs text-gray-600">Absent</p>
                </div>
              </div>
            </div>

            {/* Alert */}
            {isLowAttendance && (
              <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-900">Low Attendance</p>
                  <p className="text-xs text-red-700 mt-1">Your attendance is below 75%. Please improve.</p>
                </div>
              </div>
            )}

            {/* Details */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs font-bold text-gray-400 uppercase mb-3">Academic Year</p>
              <p className="text-sm text-gray-800">{session.academic_year}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}