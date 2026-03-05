import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { HelpCircle, BarChart3, FileText, Image, User, Shield, LogOut } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function StudentMore() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('student_session') || localStorage.getItem('student_session');
    let parsedSession = null;
    try { parsedSession = raw ? JSON.parse(raw) : null; } catch (e) {}
    
    if (!parsedSession) {
      navigate('/StudentLogin');
      return;
    }
    setSession(parsedSession);

    base44.entities.SchoolProfile.list()
      .then(p => p.length && setSchoolProfile(p[0]))
      .catch(() => {});
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('student_session');
    localStorage.removeItem('student_session');
    navigate('/StudentLogin');
  };

  if (!session) return null;

  const menuItems = [
    { label: 'Fees', sub: 'View and pay fees', icon: BarChart3, color: '#1976d2', bg: '#e3f2fd', page: '/studentfees' },
    { label: 'Progress Card', sub: 'View progress reports', icon: FileText, color: '#e91e63', bg: '#fce4ec', page: '/results' },
    { label: 'Quiz', sub: 'Take quizzes', icon: HelpCircle, color: '#f57c00', bg: '#fff3e0', page: '/quiz' },
    { label: 'Gallery', sub: 'School photos', icon: Image, color: '#00796b', bg: '#e0f2f1', page: '/gallery' },
    { label: 'Profile', sub: 'View your profile', icon: User, color: '#5c6bc0', bg: '#e8eaf6', page: '/studentprofile' },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">More</h1>
        <p className="text-sm text-blue-100">Additional options</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a237e] to-[#3949ab] flex items-center justify-center text-white font-bold">
              {session.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{session.name}</p>
              <p className="text-xs text-gray-500">Class {session.class_name}-{session.section}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              to={item.page}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.bg }}>
                <item.icon className="h-5 w-5" style={{ color: item.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Account Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          <p className="px-4 pt-3.5 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Account</p>
          <Link
           to="/studentprofile"
           className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">Change Password</p>
              <p className="text-xs text-gray-500 mt-0.5">Update your password</p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <LogOut className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900">Logout</p>
              <p className="text-xs text-gray-500 mt-0.5">Sign out of your account</p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 py-4">
          {schoolProfile?.school_name || 'BVM School of Excellence'}
        </p>
      </div>
    </div>
  );
}