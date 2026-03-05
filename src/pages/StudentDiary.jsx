import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Notebook } from 'lucide-react';
import { createPageUrl } from '@/utils';

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function StudentDiary() {
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) {
      window.location.href = createPageUrl('StudentLogin');
      return;
    }
    setStudent(session);
    // Mark diary as read
    base44.functions.invoke('markStudentNotificationsRead', {
      student_id: session.student_id,
      event_types: ['DIARY_PUBLISHED'],
    }).catch(() => {});
  }, []);

  const { data: diaryList = [], isLoading } = useQuery({
    queryKey: ['student-diary', student?.class_name],
    queryFn: async () => {
      if (!student?.class_name) return [];
      try {
        const records = await base44.entities.Diary.filter({
          class_name: student.class_name,
          section: student.section || 'A',
        }, '-diary_date', 500);
        return records || [];
      } catch {
        return [];
      }
    },
    enabled: !!student?.class_name,
  });

  if (!student) return null;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">Class Diary</h1>
        <p className="text-sm text-blue-100">Daily class updates</p>
      </header>

      <div className="px-4 py-6 space-y-3">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-pink-200 border-t-pink-600 rounded-full animate-spin" />
          </div>
        ) : diaryList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Notebook className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No diary entries yet</p>
          </div>
        ) : (
          diaryList.map((entry) => (
            <div key={entry.id} className="bg-white rounded-2xl shadow-sm p-4 border-l-4 border-pink-500">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{entry.title}</h3>
                  {entry.diary_date && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {format(new Date(entry.diary_date + 'T00:00:00'), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{entry.description}</p>
              {entry.subject_name && (
                <div className="mt-2 flex gap-1 flex-wrap">
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {entry.subject_name}
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}