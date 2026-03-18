import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Home } from 'lucide-react';

export default function StudentMinimalFooterNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 w-full z-50">
      <div className="mx-3 md:mx-4 mb-3 md:mb-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/60 dark:border-gray-700/60">
        <div className="flex items-center justify-center px-4 py-3">
          <Link
            to={createPageUrl('StudentDashboard')}
            className="flex flex-col items-center gap-1 px-6 py-3 transition-all min-h-[60px] justify-center"
          >
            <div className="bg-gradient-to-br from-[#1a237e] to-[#3949ab] shadow-md p-2.5 rounded-xl">
              <Home className="h-6 w-6 text-white" />
            </div>
            <span className="text-sm font-bold text-[#1a237e] dark:text-indigo-400">Home</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}