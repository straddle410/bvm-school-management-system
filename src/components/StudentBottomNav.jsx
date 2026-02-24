import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { GraduationCap, Bell, Brain, Trophy, BookOpen, MessageSquare } from 'lucide-react';

const navItems = [
  { label: 'Home', icon: GraduationCap, page: 'StudentDashboard' },
  { label: 'Homework', icon: BookOpen, page: 'StudentHomework' },
  { label: 'Quiz', icon: Brain, page: 'Quiz' },
  { label: 'Results', icon: Trophy, page: 'Results' },
  { label: 'Messages', icon: MessageSquare, page: 'StudentMessaging', badge: true },
];

export default function StudentBottomNav({ currentPage }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [studentSession, setStudentSession] = useState(null);

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('student_session'));
      setStudentSession(session);
    } catch {}
  }, []);

  useEffect(() => {
    if (!studentSession?.username) return;
    
    const fetchUnread = async () => {
      try {
        const messages = await base44.entities.Message.filter({
          recipient_id: studentSession.student_id,
          is_read: false
        });
        setUnreadCount(messages.length);
      } catch {}
    };

    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [studentSession]);

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all relative ${
                isActive ? 'text-[#1a237e]' : 'text-gray-400'
              }`}
            >
              <item.icon className={`h-6 w-6 ${isActive ? 'text-[#1a237e]' : 'text-gray-400'}`} />
              {item.badge && unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
              <span className={`text-[10px] font-medium ${isActive ? 'text-[#1a237e]' : 'text-gray-400'}`}>
                {item.label}
              </span>
              {isActive && <div className="w-1 h-1 rounded-full bg-[#1a237e] mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}