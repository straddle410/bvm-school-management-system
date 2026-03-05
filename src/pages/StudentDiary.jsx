import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';

export default function StudentDiary() {
  console.log('[ENTRY] StudentDiary:', window.location.pathname);
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

    // Mark DIARY_PUBLISHED notifications as read
    const markNotificationsRead = async () => {
      try {
        const notifications = await base44.entities.Notification.filter({
          recipient_email: parsedSession.email,
          notification_type: 'DIARY_PUBLISHED',
          is_read: false
        });
        for (const notif of notifications) {
          await base44.entities.Notification.update(notif.id, { is_read: true });
        }
      } catch {}
    };
    markNotificationsRead();
  }, [navigate]);

  const { data: diaryEntries = [], isLoading } = useQuery({
    queryKey: ['student-diary', session?.id],
    queryFn: async () => {
      if (!session?.id) return [];
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
    enabled: !!session?.id
  });

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">Class Diary</h1>
        <p className="text-sm text-blue-100">Academic updates and announcements</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : diaryEntries.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <BookOpen className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No diary entries yet</p>
          </div>
        ) : (
          diaryEntries.map((entry) => (
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