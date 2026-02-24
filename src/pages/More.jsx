import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getStaffSession, clearStaffSession } from '@/components/useStaffSession';
import {
  Megaphone, ClipboardList, LayoutDashboard, Users, UserPlus, BookOpen,
  ClipboardCheck, Settings, ChevronRight, LogOut, GraduationCap,
  Phone, Globe, Shield, HelpCircle, Info, LogIn, MessageSquare
} from 'lucide-react';

export default function More() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schoolProfile, setSchoolProfile] = useState(null);

  useEffect(() => {
    base44.entities.SchoolProfile.list().then(p => p.length && setSchoolProfile(p[0])).catch(() => {});
    const session = getStaffSession();
    if (session) {
      setUser(session);
      setLoading(false);
    } else {
      base44.auth.me().then(u => {
        setUser(u);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, []);

  const role = user?.role || '';
  const isAdmin = ['Admin', 'Principal'].includes(role);
  const isTeacher = ['Admin', 'Principal', 'Teacher', 'Staff'].includes(role);

  const contentItems = [
    { label: 'Post Notice', sub: 'Create school announcement', icon: Megaphone, color: '#43a047', bg: '#e8f5e9', page: 'Notices' },
    { label: 'Marks Entry', sub: 'Enter class-wise marks', icon: ClipboardList, color: '#1e88e5', bg: '#e3f2fd', page: 'Marks' },
    { label: 'Take Attendance', sub: 'Mark daily attendance', icon: ClipboardCheck, color: '#26a69a', bg: '#e0f2f1', page: 'Attendance' },
    { label: 'Messages', sub: 'Inbox & send messages', icon: MessageSquare, color: '#1a237e', bg: '#e8eaf6', page: 'Messaging' },
  ];

  const adminItems = [
    { label: 'Students', sub: 'Manage student records', icon: Users, color: '#5c6bc0', bg: '#e8eaf6', page: 'Students' },
    { label: 'Teachers', sub: 'Manage faculty', icon: Users, color: '#7e57c2', bg: '#ede7f6', page: 'Teachers' },
    { label: 'Admissions', sub: 'Online admission management', icon: UserPlus, color: '#26a69a', bg: '#e0f2f1', page: 'Admissions' },
    { label: 'Staff Management', sub: 'Create & manage staff accounts', icon: Users, color: '#e53935', bg: '#ffebee', page: 'StaffManagement' },
    { label: 'Approvals', sub: 'Bulk approve items', icon: ClipboardCheck, color: '#43a047', bg: '#e8f5e9', page: 'Approvals' },
    { label: 'ID Cards', sub: 'Generate student ID cards', icon: LayoutDashboard, color: '#1a237e', bg: '#e8eaf6', page: 'IDCards' },
    { label: 'Reports', sub: 'Analytics & reports', icon: BookOpen, color: '#e53935', bg: '#ffebee', page: 'Reports' },
    { label: 'Settings', sub: 'School configuration', icon: Settings, color: '#78909c', bg: '#eceff1', page: 'Settings' },
  ];

  const supportItems = [
    { label: 'Contact School', sub: schoolProfile?.phone || '+91 98765 43210', icon: Phone, color: '#e53935', bg: '#ffebee' },
    { label: 'School Website', sub: schoolProfile?.website || 'www.bvmschool.edu', icon: Globe, color: '#1e88e5', bg: '#e3f2fd' },
    { label: 'Privacy Policy', icon: Shield, color: '#7e57c2', bg: '#ede7f6' },
    { label: 'Help & FAQ', icon: HelpCircle, color: '#9c27b0', bg: '#f3e5f5' },
    { label: 'About App', sub: 'Version 2.0.0', icon: Info, color: '#78909c', bg: '#eceff1' },
  ];

  const MenuItem = ({ item, onClick }) => {
    const inner = (
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.bg }}>
          <item.icon className="h-5 w-5" style={{ color: item.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
          {item.sub && <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>}
        </div>
        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
      </div>
    );

    if (onClick) return <div onClick={onClick} className="cursor-pointer">{inner}</div>;
    if (item.page) return <Link to={createPageUrl(item.page)}>{inner}</Link>;
    return inner;
  };

  return (
    <div className="bg-gray-100 min-h-screen pb-6">

      {/* ---- LOGGED OUT STATE ---- */}
      {!loading && !user ? (
        <>
          {/* Hero Card */}
          <div className="bg-[#1a237e] px-4 pt-6 pb-10">
            <div className="bg-[#283593] rounded-2xl p-6 flex flex-col items-center text-white">
              <div className="w-20 h-20 rounded-2xl bg-[#1a237e] border-2 border-yellow-400 flex items-center justify-center mb-4">
                <GraduationCap className="h-10 w-10 text-yellow-400" />
              </div>
              <p className="font-bold text-xl text-center">{schoolProfile?.school_name || 'BVM School of Excellence'}</p>
              <p className="text-white/60 text-sm mt-1 text-center">{schoolProfile?.tagline || 'Building Future Leaders'}</p>
              <button
                onClick={() => window.location.href = createPageUrl('StaffLogin')}
                className="mt-5 flex items-center gap-2 px-8 py-3 bg-yellow-400 text-gray-900 rounded-full text-sm font-bold transition-colors hover:bg-yellow-300 active:bg-yellow-500 w-full justify-center"
              >
                <LogIn className="h-4 w-4" />
                Login / Sign Up
              </button>
            </div>
          </div>

          {/* Support Section */}
          <div className="-mt-4 px-4 space-y-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Support</p>
              <div className="divide-y divide-gray-50">
                {supportItems.map(item => <MenuItem key={item.label} item={item} />)}
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 py-2">{schoolProfile?.school_name || 'BVM School of Excellence'}</p>
          </div>
        </>
      ) : (
        <>
          {/* ---- LOGGED IN STATE ---- */}
          <div className="bg-[#1a237e] px-4 pt-6 pb-8">
            <div className="bg-[#283593] rounded-2xl p-5 flex flex-col items-center text-white">
              <div className="w-16 h-16 rounded-full bg-[#3949ab] border-2 border-white/30 flex items-center justify-center text-2xl font-bold">
                {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '?'}
              </div>
              {loading ? (
                <p className="mt-3 text-white/70 text-sm">Loading...</p>
              ) : (
                <>
                  <p className="mt-3 font-bold text-lg">{user?.full_name}</p>
                  <span className="mt-1 px-3 py-0.5 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full capitalize">
                    {user?.role || 'User'}
                  </span>
                  <button
                    onClick={() => { clearStaffSession(); window.location.reload(); }}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="-mt-4 px-4 space-y-4">
            {/* Create Content - Teachers & Staff */}
            {isTeacher && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Create Content</p>
                <div className="divide-y divide-gray-50">
                  {contentItems.map(item => <MenuItem key={item.label} item={item} />)}
                </div>
              </div>
            )}

            {/* Admin Controls */}
            {isAdmin && (
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Admin Controls</p>
                <div className="divide-y divide-gray-50">
                  {adminItems.map(item => <MenuItem key={item.label} item={item} />)}
                </div>
              </div>
            )}

            {/* Support */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Support</p>
              <div className="divide-y divide-gray-50">
                {supportItems.map(item => <MenuItem key={item.label} item={item} />)}
              </div>
            </div>

            <p className="text-center text-xs text-gray-400 py-2">{schoolProfile?.school_name || 'BVM School of Excellence'}</p>
          </div>
        </>
      )}
    </div>
  );
}