import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Calendar, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import StudentMinimalFooterNav from '@/components/StudentMinimalFooterNav';

export default function StudentDiary() {

  const navigate = useNavigate();
  const [session] = useState(() => {
    try { const s = localStorage.getItem('student_session'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!session) navigate(createPageUrl('StudentLogin'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark diary_published notifications as read on page open
  useEffect(() => {
    if (!session?.student_id) return;
    base44.entities.Notification.filter({
      recipient_student_id: session.student_id,
      type: 'diary_published',
      is_read: false,
    }).then(notifs => {
      if (!notifs.length) return;
      return Promise.all(notifs.map(n => base44.entities.Notification.update(n.id, { is_read: true })))
        .then(() => window.dispatchEvent(new CustomEvent('student-notifications-read')));
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: diaryEntries = [], isLoading } = useQuery({
    queryKey: ['student-diary', session?.student_id, selectedDate],
    queryFn: async () => {
      if (!session?.student_id) return [];
      try {
        const filterDate = selectedDate || format(new Date(), 'yyyy-MM-dd');
        const entries = await base44.entities.Diary.filter({
          class_name: session.class_name,
          section: session.section,
          academic_year: session.academic_year,
          status: 'Published',
          diary_date: filterDate,
        }, '-created_date', 50);
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

  // Data already filtered by date at API level
  const filteredEntries = diaryEntries;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(createPageUrl('StudentDashboard'))} className="p-1 hover:bg-white/20 rounded-lg transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Class Diary</h1>
            <p className="text-sm text-blue-100">Academic updates and announcements</p>
          </div>
        </div>
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
                  {entry.created_date ? new Date(entry.created_date.endsWith('Z') || entry.created_date.includes('+') ? entry.created_date : entry.created_date + 'Z').toLocaleDateString('en-IN', { timeZone: 'Asia/Calcutta' }) : ''}
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
        <StudentMinimalFooterNav />
        </div>
        );
        }