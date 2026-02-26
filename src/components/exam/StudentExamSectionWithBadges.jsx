import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Ticket, Calendar, TrendingUp, FileText } from 'lucide-react';

export default function StudentExamSectionWithBadges({ studentSession }) {
  const [badgeCounts, setBadgeCounts] = useState({
    hall_ticket: 0,
    results: 0,
    progress_card: 0
  });

  useEffect(() => {
    if (!studentSession?.student_id) return;

    const fetchBadges = async () => {
      try {
        const unreadNotifs = await base44.entities.Notification.filter({
          recipient_student_id: studentSession.student_id,
          is_read: false,
        });

        const counts = { hall_ticket: 0, results: 0, progress_card: 0 };
        for (const notif of unreadNotifs) {
          if (notif.type === 'hall_ticket_published') counts.hall_ticket++;
          else if (notif.type === 'marks_published' || notif.type === 'results_posted') counts.results++;
        }
        setBadgeCounts(counts);
      } catch (err) {
        console.error('Failed to fetch badge counts:', err);
      }
    };

    fetchBadges();

    // Subscribe to real-time updates
    const unsub = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' && event.data?.recipient_student_id === studentSession.student_id) {
        fetchBadges();
      }
      if (event.type === 'update' && event.data?.recipient_student_id === studentSession.student_id) {
        fetchBadges();
      }
    });

    return unsub;
  }, [studentSession?.student_id]);

  const examItems = [
    {
      label: 'Hall Ticket',
      icon: Ticket,
      sub: 'View exam hall tickets',
      color: '#d32f2f',
      bg: '#ffebee',
      page: 'StudentHallTicketView',
      badgeKey: 'hall_ticket'
    },
    {
      label: 'Exam Timetable',
      icon: Calendar,
      sub: 'Check exam schedule',
      color: '#1976d2',
      bg: '#e3f2fd',
      page: 'StudentHallTicketView',
      badgeKey: null
    },
    {
      label: 'Results',
      icon: TrendingUp,
      sub: 'View exam results',
      color: '#388e3c',
      bg: '#e8f5e9',
      page: 'Results',
      badgeKey: 'results'
    },
    {
      label: 'Progress Card',
      icon: FileText,
      sub: 'Academic progress report',
      color: '#7b1fa2',
      bg: '#f3e5f5',
      page: 'Results',
      badgeKey: 'progress_card'
    },
  ];

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">📚 Exam</p>
      <div className="divide-y divide-gray-50">
        {examItems.map((item) => {
          const badge = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
          return (
            <Link key={item.label} to={createPageUrl(item.page)}>
              <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors relative">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: item.bg }}
                >
                  <item.icon className="h-5 w-5" style={{ color: item.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
                </div>
                {badge > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}