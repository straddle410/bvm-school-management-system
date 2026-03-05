import React, { useState, useEffect } from 'react';
import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Bell, Pin } from 'lucide-react';
import { createPageUrl } from '@/utils';

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

const TYPE_COLORS = {
  General: 'bg-blue-100 text-blue-700',
  Exam: 'bg-purple-100 text-purple-700',
  Holiday: 'bg-red-100 text-red-700',
  PTM: 'bg-green-100 text-green-700',
  Fee: 'bg-amber-100 text-amber-700',
  Urgent: 'bg-red-500 text-white',
  Event: 'bg-pink-100 text-pink-700',
};

export default function StudentNotices() {
  const [student, setStudent] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) {
      window.location.href = createPageUrl('StudentLogin');
      return;
    }
    setStudent(session);
    // Mark notices as read
    base44.functions.invoke('markStudentNotificationsRead', {
      student_id: session.student_id,
      event_types: ['NOTICE_PUBLISHED'],
    }).catch(() => {});
  }, []);

  const { data: allNotices = [], isLoading } = useQuery({
    queryKey: ['student-notices'],
    queryFn: async () => {
      try {
        const records = await base44.entities.Notice.list('-created_date');
        return records || [];
      } catch {
        return [];
      }
    },
  });

  if (!student) return null;

  // Filter published notices for student's class
  const noticesList = allNotices.filter((n) => {
    if (n.status !== 'Published') return false;
    if (n.target_audience === 'Students') {
      if (!n.target_classes || n.target_classes.length === 0) return true; // All classes
      return n.target_classes.includes(student.class_name);
    }
    if (n.target_audience === 'All') return true;
    return false;
  });

  const pinned = noticesList.filter((n) => n.is_pinned);
  const regular = noticesList.filter((n) => !n.is_pinned);

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">Notices</h1>
        <p className="text-sm text-blue-100">School announcements</p>
      </header>

      <div className="px-4 py-6 space-y-3">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : noticesList.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Bell className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No notices available</p>
          </div>
        ) : (
          <>
            {/* Pinned */}
            {pinned.length > 0 && (
              <>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1 px-1">
                  <Pin className="h-3 w-3" /> Pinned
                </p>
                <div className="space-y-2">
                  {pinned.map((notice) => (
                    <NoticeCard key={notice.id} notice={notice} expanded={expandedId === notice.id} onExpand={setExpandedId} />
                  ))}
                </div>
              </>
            )}

            {/* Regular */}
            {regular.length > 0 && (
              <div className="space-y-2">
                {regular.map((notice) => (
                  <NoticeCard key={notice.id} notice={notice} expanded={expandedId === notice.id} onExpand={setExpandedId} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function NoticeCard({ notice, expanded, onExpand }) {
  const typeColor = TYPE_COLORS[notice.notice_type] || 'bg-slate-100 text-slate-700';
  
  return (
    <button
      onClick={() => onExpand(expanded ? null : notice.id)}
      className="w-full text-left bg-white rounded-2xl shadow-sm p-4 hover:shadow-md transition-shadow border-l-4 border-blue-500"
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-1 rounded ${typeColor}`}>
              {notice.notice_type}
            </span>
            {notice.is_pinned && <Pin className="h-3 w-3 text-yellow-500" />}
          </div>
          <h3 className="font-bold text-gray-900">{notice.title}</h3>
        </div>
      </div>
      {expanded && (
        <div className="mt-3">
          <div className="text-sm text-gray-700 leading-relaxed mb-2" dangerouslySetInnerHTML={{ __html: notice.content }} />
          {notice.publish_date && (
            <p className="text-xs text-gray-500">
              {format(new Date(notice.publish_date), 'MMM d, yyyy')}
            </p>
          )}
        </div>
      )}
      {!expanded && notice.content && (
        <p className="text-sm text-gray-600 line-clamp-1 mt-1">{notice.content}</p>
      )}
    </button>
  );
}