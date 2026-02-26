import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Ticket, Calendar, TrendingUp, FileText } from 'lucide-react';

export default function StudentExamSection() {
  const examItems = [
    {
      label: 'Hall Ticket',
      icon: Ticket,
      sub: 'View exam hall tickets',
      color: '#d32f2f',
      bg: '#ffebee',
      page: 'StudentHallTicketView'
    },
    {
      label: 'Exam Timetable',
      icon: Calendar,
      sub: 'Check exam schedule',
      color: '#1976d2',
      bg: '#e3f2fd',
      page: 'StudentHallTicketView' // Points to hall ticket page which shows timetable
    },
    {
      label: 'Results',
      icon: TrendingUp,
      sub: 'View exam results',
      color: '#388e3c',
      bg: '#e8f5e9',
      page: 'Results'
    },
    {
      label: 'Progress Card',
      icon: FileText,
      sub: 'Academic progress report',
      color: '#7b1fa2',
      bg: '#f3e5f5',
      page: 'Results' // Can point to dedicated progress card page if created
    },
  ];

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">📚 Exam</p>
      <div className="divide-y divide-gray-50">
        {examItems.map((item) => (
          <Link key={item.label} to={createPageUrl(item.page)}>
            <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
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
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}