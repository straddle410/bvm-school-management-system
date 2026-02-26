import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ClipboardList, Calendar, TrendingUp, Ticket } from 'lucide-react';

export default function TeacherExamCard() {
  const examTasks = [
    {
      label: 'Marks Entry',
      icon: ClipboardList,
      sub: 'Enter student marks',
      color: '#1976d2',
      bg: '#e3f2fd',
      page: 'Marks'
    },
    {
      label: 'View Timetable',
      icon: Calendar,
      sub: 'Check exam schedule',
      color: '#388e3c',
      bg: '#e8f5e9',
      page: 'TimetableManagement'
    },
    {
      label: 'View Results',
      icon: TrendingUp,
      sub: 'Monitor published results',
      color: '#7b1fa2',
      bg: '#f3e5f5',
      page: 'Results'
    },
  ];

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
      <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">📝 Exam Management</p>
      <div className="divide-y divide-gray-50">
        {examTasks.map((task) => (
          <Link key={task.label} to={createPageUrl(task.page)}>
            <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: task.bg }}
              >
                <task.icon className="h-5 w-5" style={{ color: task.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{task.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{task.sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}