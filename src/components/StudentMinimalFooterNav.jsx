import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home } from 'lucide-react';

export default function StudentMinimalFooterNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-50 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 shadow-lg">
      <div className="flex items-center justify-center py-1.5">
        <Link
          to={createPageUrl('StudentDashboard')}
          className="flex flex-col items-center gap-0.5 px-6 py-1 transition-all"
        >
          <div className="bg-gradient-to-br from-[#1a237e] to-[#3949ab] p-2 rounded-xl">
            <Home className="h-5 w-5 text-white" />
          </div>
          <span className="text-xs font-bold text-[#1a237e] dark:text-indigo-400">Home</span>
        </Link>
      </div>
    </nav>
  );
}