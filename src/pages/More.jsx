import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Megaphone, ClipboardList, PlusCircle, Send,
  LayoutDashboard, Users, UserPlus, BookOpen,
  ClipboardCheck, Settings, ChevronRight, LogOut, LogIn
} from 'lucide-react';

export default function More() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const isAdmin = ['admin', 'principal'].includes(user?.role);
  const isTeacher = ['admin', 'principal', 'teacher', 'staff'].includes(user?.role);

  const contentItems = [
    { label: 'Post Notice', sub: 'Create school announcement', icon: Megaphone, color: '#43a047', bg: '#e8f5e9', page: 'Notices' },
    { label: 'Marks Entry', sub: 'Enter class-wise marks', icon: ClipboardList, color: '#1e88e5', bg: '#e3f2fd', page: 'Marks' },
    { label: 'Take Attendance', sub: 'Mark daily attendance', icon: ClipboardCheck, color: '#26a69a', bg: '#e0f2f1', page: 'Attendance' },
    { label: 'Add Event', sub: 'Post to school calendar', icon: Send, color: '#e53935', bg: '#ffebee', page: 'Calendar' },
  ];

  const adminItems = [
    { label: 'Students', sub: 'Manage student records', icon: Users, color: '#5c6bc0', bg: '#e8eaf6', page: 'Students' },
    { label: 'Teachers', sub: 'Manage faculty', icon: Users, color: '#7e57c2', bg: '#ede7f6', page: 'Teachers' },
    { label: 'Admissions', sub: 'Online admission management', icon: UserPlus, color: '#26a69a', bg: '#e0f2f1', page: 'Admissions' },
    { label: 'Staff Management', sub: 'Create & manage staff accounts', icon: Users, color: '#e53935', bg: '#ffebee', page: 'StaffManagement' },
    { label: 'Exam & Marks', sub: 'Manage exams and results', icon: BookOpen, color: '#ab47bc', bg: '#f3e5f5', page: 'Marks' },
    { label: 'Attendance', sub: 'Daily attendance tracking', icon: ClipboardCheck, color: '#ef6c00', bg: '#fff3e0', page: 'Attendance' },
    { label: 'Approvals', sub: 'Bulk approve items', icon: ClipboardCheck, color: '#43a047', bg: '#e8f5e9', page: 'Approvals' },
    { label: 'ID Cards', sub: 'Generate student ID cards', icon: LayoutDashboard, color: '#1a237e', bg: '#e8eaf6', page: 'IDCards' },
    { label: 'Reports', sub: 'Analytics & reports', icon: LayoutDashboard, color: '#e53935', bg: '#ffebee', page: 'Reports' },
    { label: 'Settings', sub: 'School configuration', icon: Settings, color: '#78909c', bg: '#eceff1', page: 'Settings' },
  ];

  const MenuItem = ({ item }) => (
    <Link to={createPageUrl(item.page)}>
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.bg }}>
          <item.icon className="h-5 w-5" style={{ color: item.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
          <p className="text-xs text-gray-500">{item.sub}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
      </div>
    </Link>
  );

  return (
    <div className="bg-gray-100 min-h-screen pb-6">
      {/* User Card */}
      <div className="bg-[#1a237e] px-4 pt-6 pb-8">
        <div className="bg-[#283593] rounded-2xl p-5 flex flex-col items-center text-white">
          <Avatar className="h-16 w-16 border-2 border-white/30">
            <AvatarImage src={user?.photo_url} />
            <AvatarFallback className="bg-[#3949ab] text-white text-xl font-bold">
              {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '?'}
            </AvatarFallback>
          </Avatar>
          {loading ? (
            <p className="mt-3 text-white/70 text-sm">Loading...</p>
          ) : user ? (
            <>
              <p className="mt-3 font-bold text-lg">{user.full_name}</p>
              <span className="mt-1 px-3 py-0.5 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full capitalize">
                {user.role || 'User'}
              </span>
              <button
                onClick={() => base44.auth.logout()}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <p className="mt-3 font-bold text-lg">Guest</p>
              <button
                onClick={() => base44.auth.redirectToLogin()}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-yellow-400 text-gray-900 rounded-xl text-sm font-bold transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Login
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="-mt-4 px-4 space-y-4">
        {/* Create Content Section */}
        {isTeacher && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Create Content
            </p>
            <div className="divide-y divide-gray-50">
              {contentItems.map(item => <MenuItem key={item.label} item={item} />)}
            </div>
          </div>
        )}

        {/* Admin Controls */}
        {isAdmin && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              Admin Controls
            </p>
            <div className="divide-y divide-gray-50">
              {adminItems.map(item => <MenuItem key={item.label} item={item} />)}
            </div>
          </div>
        )}

        {/* General for all logged in users */}
        {user && !isTeacher && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
              My Account
            </p>
            <div className="divide-y divide-gray-50">
              <MenuItem item={{ label: 'My Profile', sub: 'View and edit profile', icon: Users, color: '#5c6bc0', bg: '#e8eaf6', page: 'Profile' }} />
            </div>
          </div>
        )}

        {!user && !loading && (
          <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <p className="text-gray-500 text-sm">Login to access more features</p>
          </div>
        )}
      </div>
    </div>
  );
}