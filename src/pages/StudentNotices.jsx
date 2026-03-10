import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Bell, ArrowLeft } from 'lucide-react';

export default function StudentNotices() {
  console.log('[ENTRY] StudentNotices:', window.location.pathname);
  console.log('[SESSION] localStorage:', localStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');
  console.log('[SESSION] sessionStorage:', sessionStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');

  const navigate = useNavigate();
  const [session] = useState(() => {
    try { const s = localStorage.getItem('student_session'); return s ? JSON.parse(s) : null; } catch { return null; }
  });

  useEffect(() => {
    if (!session) navigate(createPageUrl('StudentLogin'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark notice_posted notifications as read on page open
  useEffect(() => {
    if (!session?.student_id) return;
    base44.entities.Notification.filter({
      recipient_student_id: session.student_id,
      type: 'notice_posted',
      is_read: false,
    }).then(notifs => {
      if (!notifs.length) return;
      return Promise.all(notifs.map(n => base44.entities.Notification.update(n.id, { is_read: true })))
        .then(() => window.dispatchEvent(new CustomEvent('student-notifications-read')));
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['student-notices', session?.student_id],
    queryFn: async () => {
      if (!session?.student_id) return [];
      try {
        const allNotices = await base44.entities.Notice.filter({
          academic_year: session.academic_year,
          status: 'Published'
        }, '-created_date', 500);
        
        // Filter notices that target this student's class or all classes
        return (allNotices || []).filter(notice => {
          if (notice.target_audience !== 'Students') return false;
          if (!notice.target_classes || notice.target_classes.length === 0) return true;
          return notice.target_classes.includes(session.class_name);
        });
      } catch {
        return [];
      }
    },
    enabled: !!session?.student_id,
    staleTime: 5 * 60 * 1000,
  });

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(createPageUrl('StudentDashboard'))} className="p-1 hover:bg-white/20 rounded-lg transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Notices</h1>
            <p className="text-sm text-blue-100">School announcements</p>
          </div>
        </div>
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