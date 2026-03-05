import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';

export default function StudentNotices() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('student_session') || localStorage.getItem('student_session');
    let parsedSession = null;
    try { parsedSession = raw ? JSON.parse(raw) : null; } catch (e) {}
    
    if (!parsedSession) {
      navigate('/StudentLogin');
      return;
    }
    setSession(parsedSession);

    // Mark NOTICE_PUBLISHED notifications as read
    const markNotificationsRead = async () => {
      try {
        const notifications = await base44.entities.Notification.filter({
          recipient_email: parsedSession.email,
          notification_type: 'NOTICE_PUBLISHED',
          is_read: false
        });
        for (const notif of notifications) {
          await base44.entities.Notification.update(notif.id, { is_read: true });
        }
      } catch {}
    };
    markNotificationsRead();
  }, [navigate]);

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['student-notices', session?.id],
    queryFn: async () => {
      if (!session?.id) return [];
      try {
        const allNotices = await base44.entities.Notice.filter({
          class_name: session.class_name,
          section: session.section,
          academic_year: session.academic_year,
          status: 'Published'
        }, '-created_date', 500);
        return allNotices || [];
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
        <h1 className="text-lg font-bold">Notices</h1>
        <p className="text-sm text-blue-100">School announcements</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : notices.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Bell className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No notices published yet</p>
          </div>
        ) : (
          notices.map((notice) => (
            <div key={notice.id} className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-sm font-bold text-gray-900">{notice.title}</h3>
                <p className="text-xs text-gray-500">
                  {new Date(notice.created_date).toLocaleDateString()}
                </p>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{notice.content}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}