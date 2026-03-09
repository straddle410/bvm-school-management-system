import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentDiary() {
  console.log('[ENTRY] StudentDiary:', window.location.pathname);
  console.log('[SESSION] localStorage:', localStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');
  console.log('[SESSION] sessionStorage:', sessionStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');

  const navigate = useNavigate();
  const [session] = useState(() => {
    try { const s = localStorage.getItem('student_session'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!session) navigate(createPageUrl('StudentLogin'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark DIARY_PUBLISHED notifications as read — separate effect, runs once on mount
  useEffect(() => {
    if (!session?.email) return;
    const markNotificationsRead = async () => {
      try {
        const notifications = await base44.entities.Notification.filter({
          recipient_email: session.email,
          notification_type: 'DIARY_PUBLISHED',
          is_read: false
        });
        for (const notif of notifications) {
          await base44.entities.Notification.update(notif.id, { is_read: true });
        }
      } catch {}
    };
    markNotificationsRead();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: diaryEntries = [], isLoading } = useQuery({
    queryKey: ['student-diary', session?.student_id],
    queryFn: async () => {
      if (!session?.student_id) return [];
      try {
        const entries = await base44.entities.Diary.filter({
          class_name: session.class_name,
          section: session.section,
          academic_year: session.academic_year,
          status: 'Published'
        }, '-created_date', 500);
        return entries || [];
      } catch {
        return [];
      }
    },
    enabled: !!session?.student_id,
    staleTime: 5 * 60 * 1000,
  });

  if (!session) return null;

  // Get today's date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDateString = format(today, 'yyyy-MM-dd');

  // Filter entries by selected date (or today)
  const filteredEntries = diaryEntries.filter(entry => {
    const filterDate = selectedDate || todayDateString;
    const entryDate = entry.diary_date ? format(new Date(entry.diary_date), 'yyyy-MM-dd') : format(new Date(entry.created_date), 'yyyy-MM-dd');
    return entryDate === filterDate;
  });

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">Class Diary</h1>
        <p className="text-sm text-blue-100">Academic updates and announcements</p>
      </header>

      <div className="px-4 py-6 space-y-4">
         {/* Date Picker */}
         <div className="bg-white rounded-2xl p-3 shadow-sm">
           <div className="flex items-center justify-between">
             <label className="text-xs font-semibold text-gray-700 flex items-center gap-2">
               <Calendar className="h-4 w-4 text-[#1a237e]" />
               Select Date
             </label>
             <input
               type="date"
               value={selectedDate || todayDateString}
               onChange={(e) => setSelectedDate(e.target.value)}
               className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
             />
           </div>
           {selectedDate && (
             <button
               onClick={() => setSelectedDate(null)}
               className="mt-2 text-xs font-semibold text-[#1a237e] underline w-full text-left"
             >
               ↻ Clear Date (Today)
             </button>
           )}
         </div>

         {isLoading ? (
           <div className="text-center py-8">
             <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
           </div>
         ) : filteredEntries.length === 0 ? (
           <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
             <BookOpen className="h-10 w-10 text-gray-200 mx-auto mb-2" />
             <p className="text-sm text-gray-500">No diary entries for this date</p>
           </div>
         ) : (
           filteredEntries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-900">{entry.subject}</h3>
                <p className="text-xs text-gray-500">
                  {new Date(entry.created_date).toLocaleDateString()}
                </p>
              </div>
              {entry.teacher_name && (
                <p className="text-xs text-gray-600 mb-2">By: {entry.teacher_name}</p>
              )}
              <p className="text-sm text-gray-700 leading-relaxed">{entry.description}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}