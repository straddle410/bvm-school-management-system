import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Calendar, AlertCircle } from 'lucide-react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentTimetable() {
  console.log('[ENTRY] StudentTimetable:', window.location.pathname);
  console.log('[SESSION] localStorage:', localStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');
  console.log('[SESSION] sessionStorage:', sessionStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');

  const navigate = useNavigate();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('student_session') || localStorage.getItem('student_session');
    let parsedSession = null;
    try { parsedSession = raw ? JSON.parse(raw) : null; } catch (e) { console.error('[PARSE ERROR]', e); }
    
    if (!parsedSession) {
      console.log('[REDIRECT] No session found, redirecting to /StudentLogin');
      navigate('/StudentLogin');
      return;
    }
    console.log('[SESSION SET] student_id:', parsedSession.id);
    setSession(parsedSession);
  }, [navigate]);

  const { data: timetableData = {}, isLoading } = useQuery({
    queryKey: ['student-timetable', session?.id],
    queryFn: async () => {
      if (!session?.id) return {};
      try {
        const res = await base44.functions.invoke('studentGetTimetable', {
          student_id: session.id,
          academic_year: session.academic_year
        });
        return res.data || {};
      } catch {
        return {};
      }
    },
    enabled: !!session?.id
  });

  if (!session) return null;

  const timetables = timetableData.timetable || [];
  const entriesByDay = {};
  DAYS.forEach(day => {
    entriesByDay[day] = timetables.filter(t => t.day === day);
  });
  const timeSlots = [...new Set(timetables.map(t => t.start_time))].sort();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 sticky top-0 z-50 shadow-md">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Class Timetable
        </h1>
        <p className="text-blue-200 text-sm mt-1">Class {session.class_name}-{session.section}</p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : timetables.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-orange-500" />
              <p className="text-gray-600 font-medium">Timetable not yet published for {timetableData.academic_year || 'this year'}.</p>
              <p className="text-sm text-gray-400">Contact your school for the timetable details.</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-3 text-left font-semibold text-gray-700">Time</th>
                    {DAYS.map(day => (
                      <th key={day} className="border p-3 text-left font-semibold text-gray-700 min-w-[120px]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.map(time => (
                    <tr key={time} className="hover:bg-gray-50">
                      <td className="border p-3 font-semibold bg-gray-50 text-gray-700 whitespace-nowrap">
                        {time}
                        {timetables.find(t => t.start_time === time) && (
                          <span className="text-xs text-gray-500 block">
                            – {timetables.find(t => t.start_time === time)?.end_time}
                          </span>
                        )}
                      </td>
                      {DAYS.map(day => {
                        const entry = entriesByDay[day]?.find(t => t.start_time === time);
                        return (
                          <td key={`${day}-${time}`} className="border p-3 text-sm">
                            {entry ? (
                              <div className="space-y-1 bg-blue-50 p-2 rounded-lg border border-blue-200">
                                <div className="font-semibold text-blue-900">{entry.subject}</div>
                                <div className="text-xs text-gray-700">{entry.teacher_name}</div>
                                {entry.room_number && (
                                  <div className="text-xs text-gray-500">Room: {entry.room_number}</div>
                                )}
                              </div>
                            ) : (
                              <div className="text-gray-300 text-center py-4">–</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}