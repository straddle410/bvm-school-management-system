import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { GraduationCap, BookOpen, Brain, Trophy, MessageSquare } from 'lucide-react';

const navItems = [
  { label: 'Home',     icon: GraduationCap, page: 'StudentDashboard' },
  { label: 'Notices', icon: Bell,          page: 'Notices' },
  { label: 'Diary',    icon: BookOpen,     page: 'Diary' },
  { label: 'Messages', icon: MessageSquare,  page: 'StudentMessaging', messagesBadge: true },
  { label: 'More',     icon: MoreHorizontal, page: 'More' },
];

export default function StudentBottomNav({ currentPage }) {
  const [badges, setBadges] = useState({ quiz_posted: 0, results_posted: 0, messages: 0 });
  const [studentSession, setStudentSession] = useState(null);

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('student_session'));
      setStudentSession(session);
    } catch {}
  }, []);

  useEffect(() => {
    if (!studentSession?.student_id) return;

    const fetchBadges = async () => {
      try {
        const [notifs, unreadMsgs] = await Promise.all([
          base44.entities.Notification.filter({
            recipient_student_id: studentSession.student_id,
            is_read: false,
          }),
          base44.entities.Message.filter({
            recipient_id: studentSession.student_id,
            is_read: false,
          }),
        ]);

        const counts = { quiz_posted: 0, results_posted: 0, messages: 0 };
        for (const n of notifs) {
          if (n.type === 'quiz_posted') counts.quiz_posted++;
          else if (n.type === 'results_posted' || n.type === 'marks_published') counts.results_posted++;
          else if (n.type === 'class_message') counts.messages++;
        }
        // FIX #2: Only count message notifications, don't double-count with unreadMsgs
        // Message notifications already captured in class_message count above
        setBadges(counts);
      } catch {}
    };

    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);

    // Real-time update
    const unsub1 = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' && event.data?.recipient_student_id === studentSession.student_id) {
        fetchBadges();
      }
      if (event.type === 'update' && event.data?.recipient_student_id === studentSession.student_id) {
        fetchBadges();
      }
    });
    const unsub2 = base44.entities.Message.subscribe((event) => {
      if (event.data?.recipient_id === studentSession.student_id) {
        fetchBadges();
      }
    });

    return () => {
      clearInterval(interval);
      unsub1();
      unsub2();
    };
  }, [studentSession]);

  const getBadgeCount = (item) => {
    if (item.messagesBadge) return badges.messages;
    if (item.notifType) return badges[item.notifType] || 0;
    return 0;
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      <div className="mx-3 mb-3 bg-white/90 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.15)] border border-white/60">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = currentPage === item.page;
            const badgeCount = getBadgeCount(item);
            return (
              <Link
                key={item.page}
                to={createPageUrl(item.page)}
                className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 transition-all"
              >
                {isActive && (
                  <span className="absolute inset-0 bg-indigo-50 rounded-2xl" />
                )}
                <div className={`relative z-10 p-1.5 rounded-xl transition-all ${isActive ? 'bg-gradient-to-br from-[#1a237e] to-[#3949ab] shadow-md' : ''}`}>
                  <item.icon className={`h-5 w-5 transition-all ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5 shadow-sm">
                      {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-semibold relative z-10 transition-all ${isActive ? 'text-[#1a237e]' : 'text-gray-400'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}