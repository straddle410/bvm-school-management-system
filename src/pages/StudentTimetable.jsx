import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { Calendar, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export default function StudentTimetable() {
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) {
      window.location.href = createPageUrl('StudentLogin');
      return;
    }
    setStudent(session);
  }, []);

  const { data: timetableData = {}, isLoading } = useQuery({
    queryKey: ['student-timetable', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return {};
      const res = await base44.functions.invoke('studentGetTimetable', {
        student_id: student.student_id
      });
      return res.data || {};
    },
    enabled: !!student?.student_id
  });

  const timetables = timetableData.timetable || [];

  if (!student) return null;

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
        <p className="text-blue-200 text-sm mt-1">Class {student.class_name}-{student.section}</p>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <Card>
            <CardContent className="py-8">
              <p className="text-gray-500 text-center">Loading timetable...</p>
            </CardContent>
          </Card>
        ) : timetables.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertCircle className="h-8 w-8 text-orange-500" />
                <p className="text-gray-600 font-medium">Timetable not yet published for {timetableData.academic_year || 'this year'}.</p>
                <p className="text-sm text-gray-400">Contact your school for the timetable details.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Weekly Schedule</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
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
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}