import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import StudentMinimalFooterNav from '@/components/StudentMinimalFooterNav';

export default function StudentAttendance() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAbsentDates, setShowAbsentDates] = useState(false);
  const [showHalfDayDates, setShowHalfDayDates] = useState(false);
  const [showMonthlyBreakdown, setShowMonthlyBreakdown] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      try {
        const stored = localStorage.getItem('student_session');
        if (!stored) {
          navigate(createPageUrl('StudentLogin'));
          return;
        }
        const parsed = JSON.parse(stored);
        setSession(parsed);
      } catch (err) {
        console.error('Session error:', err);
        navigate(createPageUrl('StudentLogin'));
      } finally {
        setLoading(false);
      }
    };
    initSession();
  }, []);

  const { data: attendanceData = {}, isLoading: isQueryLoading, error: queryError } = useQuery({
    queryKey: ['student-attendance', session?.student_id, session?.academic_year],
    queryFn: async () => {
      if (!session?.student_id || !session?.academic_year) {
        console.warn('Missing session data:', { student_id: session?.student_id, academic_year: session?.academic_year });
        return { working_days: 0, present_days: 0, absent_days: 0, percentage: 0, monthly_breakdown: [] };
      }

      try {
        const [years, students] = await Promise.all([
          base44.entities.AcademicYear.filter({ year: session.academic_year }).catch(() => []),
          base44.entities.Student.filter({ student_id: session.student_id }).catch(() => [])
        ]);

        const academicYearStart = years?.[0]?.start_date || new Date().toISOString().split('T')[0];
        const student = students?.[0];
        const effectiveStartDate = student?.admission_date || academicYearStart;
        const endDate = new Date().toISOString().split('T')[0];

        console.log('Fetching attendance:', { student_id: session.student_id, academic_year: session.academic_year, effectiveStartDate, endDate });

        const res = await base44.functions.invoke('calculateAttendanceSummaryForStudent', {
          student_id: session.student_id,
          academic_year: session.academic_year,
          start_date: effectiveStartDate,
          end_date: endDate
        });

        const data = res?.data || {};
        console.log('Attendance response:', data);
        return data;
      } catch (err) {
        console.error('Attendance fetch error:', err);
        return { working_days: 0, present_days: 0, absent_days: 0, percentage: 0, monthly_breakdown: [] };
      }
    },
    enabled: !!session?.student_id && !!session?.academic_year,
    staleTime: 5 * 60 * 1000,
  });

  const { data: absentRecords = [] } = useQuery({
    queryKey: ['student-absent-records', session?.student_id, session?.academic_year],
    queryFn: async () => {
      try {
        const records = await base44.entities.Attendance.filter({
          student_id: session.student_id,
          academic_year: session.academic_year,
          attendance_type: 'absent'
        }, '-date', 100);
        return records || [];
      } catch {
        return [];
      }
    },
    enabled: !!session?.student_id && showAbsentDates,
    staleTime: 5 * 60 * 1000,
  });

  const { data: halfDayRecords = [] } = useQuery({
    queryKey: ['student-halfday-records', session?.student_id, session?.academic_year],
    queryFn: async () => {
      try {
        const records = await base44.entities.Attendance.filter({
          student_id: session.student_id,
          academic_year: session.academic_year,
          attendance_type: 'half_day'
        }, '-date', 100);
        return records || [];
      } catch {
        return [];
      }
    },
    enabled: !!session?.student_id && showHalfDayDates,
    staleTime: 5 * 60 * 1000,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center">
        <div className="w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return null;

  const { working_days = 0, present_days = 0, absent_days = 0, percentage = 0, monthly_breakdown = [] } = attendanceData;
  const half_days = halfDayRecords?.length || 0;
  const isLowAttendance = percentage < 75;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(createPageUrl('StudentDashboard'))} className="p-1 hover:bg-white/20 rounded-lg transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">My Attendance</h1>
            <p className="text-sm text-blue-100">{session.class_name}-{session.section}</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {isQueryLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-2">Loading attendance data...</p>
          </div>
        ) : queryError ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="text-sm font-semibold text-red-900">Error Loading Data</p>
            <p className="text-xs text-red-700 mt-1">{queryError?.message || 'Please try again'}</p>
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

              <div className="grid grid-cols-2 gap-4 text-center text-sm mb-4">
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="font-bold text-blue-900">{working_days}</p>
                  <p className="text-xs text-gray-600">Working Days</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="font-bold text-green-900">{present_days.toFixed(1)}</p>
                  <p className="text-xs text-gray-600">Present</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-center text-sm">
                <button
                  onClick={() => setShowAbsentDates(!showAbsentDates)}
                  className="bg-red-50 rounded-lg p-3 hover:bg-red-100 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <p className="font-bold text-red-900">{absent_days}</p>
                    {showAbsentDates ? <ChevronUp className="h-4 w-4 text-red-700" /> : <ChevronDown className="h-4 w-4 text-red-700" />}
                  </div>
                  <p className="text-xs text-gray-600">Absent</p>
                </button>
                <button
                  onClick={() => setShowHalfDayDates(!showHalfDayDates)}
                  className="bg-orange-50 rounded-lg p-3 hover:bg-orange-100 transition-colors"
                >
                  <div className="flex items-center justify-center gap-1">
                    <p className="font-bold text-orange-900">{half_days}</p>
                    {showHalfDayDates ? <ChevronUp className="h-4 w-4 text-orange-700" /> : <ChevronDown className="h-4 w-4 text-orange-700" />}
                  </div>
                  <p className="text-xs text-gray-600">Half Day</p>
                </button>
              </div>

              {/* Monthly Breakdown Button */}
              {monthly_breakdown && monthly_breakdown.length > 0 && (
                <button
                  onClick={() => setShowMonthlyBreakdown(!showMonthlyBreakdown)}
                  className="w-full mt-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-lg p-3 hover:from-blue-100 hover:to-blue-200 transition-colors text-left"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-blue-900">Monthly Breakdown</p>
                    {showMonthlyBreakdown ? <ChevronUp className="h-4 w-4 text-blue-700" /> : <ChevronDown className="h-4 w-4 text-blue-700" />}
                  </div>
                </button>
              )}
            </div>

            {/* Monthly Breakdown */}
            {showMonthlyBreakdown && monthly_breakdown && monthly_breakdown.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Monthly Statistics</h3>
                <div className="space-y-3">
                  {monthly_breakdown.map((month, idx) => {
                    const monthPercent = month.working_days > 0 ? (month.total_present / month.working_days) * 100 : 0;
                    return (
                      <div key={idx} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900 text-sm">{month.month_display}</p>
                          <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                            monthPercent >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {monthPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs text-gray-600">
                          <div>Working: {month.working_days}</div>
                          <div>Present: {month.total_present.toFixed(1)}</div>
                          <div>Absent: {(month.working_days - month.total_present).toFixed(1)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Absent Dates List */}
            {showAbsentDates && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  Absent Dates
                </h3>
                {absentRecords.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No absent days recorded</p>
                ) : (
                  <div className="space-y-2">
                    {absentRecords.map((record) => {
                      const date = new Date(record.date);
                      return (
                        <div key={record.id} className="flex items-center justify-between bg-red-50 rounded-lg px-4 py-3 border border-red-100">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {format(date, 'dd MMM yyyy')}
                            </p>
                            <p className="text-xs text-gray-600">
                              {format(date, 'EEEE')}
                            </p>
                          </div>
                          <div className="bg-red-200 rounded-full px-3 py-1">
                            <p className="text-xs font-bold text-red-900">Absent</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Half Day Dates List */}
            {showHalfDayDates && (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  Half Day Dates
                </h3>
                {halfDayRecords.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No half day records found</p>
                ) : (
                  <div className="space-y-2">
                    {halfDayRecords.map((record) => {
                      const date = new Date(record.date);
                      return (
                        <div key={record.id} className="flex items-center justify-between bg-orange-50 rounded-lg px-4 py-3 border border-orange-100">
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {format(date, 'dd MMM yyyy')}
                            </p>
                            <p className="text-xs text-gray-600">
                              {format(date, 'EEEE')}
                            </p>
                          </div>
                          <div className="bg-orange-200 rounded-full px-3 py-1">
                            <p className="text-xs font-bold text-orange-900">Half Day</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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
      <StudentMinimalFooterNav />
    </div>
  );
}