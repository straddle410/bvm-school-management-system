import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { GraduationCap, Bell, Brain, Trophy, Calendar } from 'lucide-react';

const navItems = [
  { label: 'Home', icon: GraduationCap, page: 'StudentDashboard' },
  { label: 'Notices', icon: Bell, page: 'Notices' },
  { label: 'Quiz', icon: Brain, page: 'Quiz' },
  { label: 'Results', icon: Trophy, page: 'Results' },
  { label: 'Calendar', icon: Calendar, page: 'Calendar' },
];

export default function StudentBottomNav({ currentPage }) {
  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50 shadow-lg">
      <div className="flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = currentPage === item.page;
          return (
            <Link
              key={item.page}
              to={createPageUrl(item.page)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all ${
                isActive ? 'text-[#1a237e]' : 'text-gray-400'
              }`}
            >
              <item.icon className={`h-6 w-6 ${isActive ? 'text-[#1a237e]' : 'text-gray-400'}`} />
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