import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { ArrowLeft, Bell, MessageSquare, BookOpen, FileText, Award, Ticket, Book, CheckCheck, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import StudentBottomNav from '@/components/StudentBottomNav';

function getStudentSession() {
  try { return JSON.parse(localStorage.getItem('student_session')); } catch { return null; }
}

const TYPE_CONFIG = {
  class_message:       { icon: MessageSquare, color: '#0288d1', bg: '#e1f5fe', label: 'Message',       page: 'StudentMessaging' },
  fee_reminder:        { icon: FileText,       color: '#e65100', bg: '#fff3e0', label: 'Fee Reminder',  page: 'StudentMessaging' },
  notice_posted:       { icon: Bell,           color: '#1a237e', bg: '#e8eaf6', label: 'Notice',        page: 'StudentNotices' },
  homework_published:  { icon: BookOpen,       color: '#f57c00', bg: '#fff3e0', label: 'Homework',      page: 'StudentHomework' },
  marks_published:     { icon: Award,          color: '#1976d2', bg: '#e3f2fd', label: 'Marks',         page: 'StudentMarks' },
  results_posted:      { icon: Award,          color: '#388e3c', bg: '#e8f5e9', label: 'Results',       page: 'StudentMarks' },
  hall_ticket_published:{ icon: Ticket,        color: '#388e3c', bg: '#e8f5e9', label: 'Hall Ticket',   page: 'StudentHallTicketView' },
  diary_published:     { icon: Book,           color: '#e91e63', bg: '#fce4ec', label: 'Diary',         page: 'StudentDiary' },
  quiz_posted:         { icon: FileText,       color: '#6a1b9a', bg: '#f3e5f5', label: 'Quiz',          page: 'Quiz' },
};

const DEFAULT_CONFIG = { icon: Bell, color: '#546e7a', bg: '#eceff1', label: 'Notification', page: null };

export default function StudentNotifications() {
  const [student, setStudent] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStudentSession();
    if (!session) { window.location.href = createPageUrl('StudentLogin'); return; }
    setStudent(session);
  }, []);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['student-notif-inbox', student?.student_id],
    queryFn: () => base44.entities.Notification.filter(
      { recipient_student_id: student.student_id },
      '-created_date',
      100
    ),
    enabled: !!student?.student_id,
    refetchInterval: 30000,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ['student-notif-messages', student?.student_id],
    queryFn: () => base44.entities.Message.filter(
      { recipient_id: student.student_id },
      '-created_date',
      50
    ),
    enabled: !!student?.student_id,
    refetchInterval: 30000,
  });

  // Real-time refresh
  useEffect(() => {
    if (!student?.student_id) return;
    const unsub1 = base44.entities.Notification.subscribe((ev) => {
      if (ev.data?.recipient_student_id === student.student_id) {
        queryClient.invalidateQueries({ queryKey: ['student-notif-inbox'] });
      }
    });
    const unsub2 = base44.entities.Message.subscribe((ev) => {
      if (ev.data?.recipient_id === student.student_id) {
        queryClient.invalidateQueries({ queryKey: ['student-notif-messages'] });
      }
    });
    return () => { unsub1(); unsub2(); };
  }, [student?.student_id]);

  // Merge notifications + messages into one unified feed
  const feed = useMemo(() => {
    const notifItems = notifications.map(n => ({
      id: `notif-${n.id}`,
      rawId: n.id,
      type: 'notification',
      notifType: n.type,
      title: n.title || (TYPE_CONFIG[n.type]?.label ?? 'Notification'),
      preview: n.message || '',
      time: n.created_date,
      is_read: n.is_read,
      link_url: n.link_url || null,
    }));

    const msgItems = messages.map(m => ({
      id: `msg-${m.id}`,
      rawId: m.id,
      type: 'message',
      notifType: 'class_message',
      title: m.subject || 'Message',
      preview: m.body || '',
      time: m.created_date,
      is_read: m.is_read,
      messageId: m.id,
    }));

    return [...notifItems, ...msgItems]
      .sort((a, b) => new Date(b.time) - new Date(a.time));
  }, [notifications, messages]);

  const unreadCount = feed.filter(f => !f.is_read).length;

  const handleMarkAllRead = async () => {
    const unreadNotifs = notifications.filter(n => !n.is_read);
    const unreadMsgs = messages.filter(m => !m.is_read);
    await Promise.all([
      ...unreadNotifs.map(n => base44.entities.Notification.update(n.id, { is_read: true })),
      ...unreadMsgs.map(m => base44.entities.Message.update(m.id, { is_read: true })),
    ]);
    queryClient.invalidateQueries({ queryKey: ['student-notif-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['student-notif-messages'] });
    queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
    window.dispatchEvent(new CustomEvent('student-notifications-read'));
  };

  const handleItemClick = async (item) => {
    // Mark as read
    if (!item.is_read) {
      if (item.type === 'notification') {
        base44.entities.Notification.update(item.rawId, { is_read: true }).catch(() => {});
      } else {
        base44.entities.Message.update(item.rawId, { is_read: true }).catch(() => {});
      }
      queryClient.invalidateQueries({ queryKey: ['student-notif-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['student-notif-messages'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
      window.dispatchEvent(new CustomEvent('student-notifications-read'));
    }

    // Navigate
    if (item.link_url) {
      navigate(item.link_url);
      return;
    }
    if (item.type === 'message') {
      navigate(`${createPageUrl('StudentMessaging')}?messageId=${item.messageId}`);
      return;
    }
    const cfg = TYPE_CONFIG[item.notifType];
    if (cfg?.page) navigate(createPageUrl(cfg.page));
  };

  if (!student) return null;

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col max-w-md sm:max-w-xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white px-4 pt-4 pb-6 sticky top-0 z-40 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('StudentDashboard')} className="p-1 hover:bg-white/20 rounded-lg transition mr-1">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <Bell className="h-5 w-5 text-blue-200" />
            <h1 className="font-bold text-lg">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{unreadCount}</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            >
              <CheckCheck className="h-3.5 w-3.5" /> All Read
            </button>
          )}
        </div>
      </div>

      {/* Feed */}
      <div className="-mt-3 mx-4 z-30 relative">
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="space-y-px">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="flex items-center gap-3 p-4">
                  <div className="w-11 h-11 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-2/3" />
                    <div className="h-3 bg-gray-100 rounded animate-pulse w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : feed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Inbox className="h-12 w-12 mb-3 opacity-20" />
              <p className="text-sm font-medium">No notifications yet</p>
              <p className="text-xs mt-1 text-gray-300">Updates will appear here</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {feed.map((item) => {
                const cfg = TYPE_CONFIG[item.notifType] || DEFAULT_CONFIG;
                const Icon = cfg.icon;
                const preview = item.preview?.length > 70 ? item.preview.slice(0, 70) + '…' : item.preview;
                const timeAgo = item.time ? formatDistanceToNow(new Date(item.time), { addSuffix: true }) : '';

                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 ${!item.is_read ? 'bg-blue-50/60' : ''}`}
                  >
                    {/* Icon */}
                    <div className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: cfg.bg }}>
                      <Icon className="h-5 w-5" style={{ color: cfg.color }} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className={`text-sm leading-snug ${!item.is_read ? 'font-bold text-gray-900' : 'font-semibold text-gray-700'}`}>
                          {item.title}
                        </span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className="text-[10px] text-gray-400 whitespace-nowrap">{timeAgo}</span>
                          {!item.is_read && <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                        </div>
                      </div>
                      {preview && (
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{preview}</p>
                      )}
                      <span className="text-[10px] font-semibold mt-1 inline-block px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <StudentBottomNav currentPage="StudentNotifications" />
    </div>
  );
}