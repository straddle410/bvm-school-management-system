import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { Home, Bell, Image as ImageIcon, Calendar, MoreHorizontal, Building2 } from 'lucide-react';
import { AcademicYearProvider } from '@/components/AcademicYearContext';
import AcademicYearSelector from '@/components/AcademicYearSelector';
import StudentBottomNav from '@/components/StudentBottomNav';
import MessageNotificationListener from '@/components/messaging/MessageNotificationListener';

// Don't register here - let StudentNotificationSettings handle it on user request

const bottomNav = [
  { name: 'Home', icon: Home, page: 'Dashboard' },
  { name: 'Notices', icon: Bell, page: 'Notices' },
  { name: 'Gallery', icon: Image, page: 'Gallery' },
  { name: 'Calendar', icon: Calendar, page: 'Calendar' },
  { name: 'More', icon: MoreHorizontal, page: 'More' },
];

// Pages that don't use the app shell
const NO_LAYOUT_PAGES = ['PublicAdmission', 'StaffLogin', 'StudentLogin', 'StudentDashboard', 'StudentHomework', 'StudentHallTicketView', 'StudentMessaging', 'StudentProfile', 'UserProfile'];

// Pages students CAN visit through the layout (using bottom nav)
const STUDENT_ALLOWED_PAGES = ['Dashboard', 'Notices', 'Gallery', 'Calendar', 'Quiz', 'Results', 'More'];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [studentSession, setStudentSession] = useState(null);

  useEffect(() => {
    // Check student session first
    let ss = null;
      try {
        const raw = localStorage.getItem('student_session');
        if (raw) { ss = JSON.parse(raw); setStudentSession(ss); }
      } catch {}
      loadData(!!ss);
  }, []);

  const loadData = async (hasStudentSession) => {
    // If student session exists, don't call auth.me() - just load school profile
    if (hasStudentSession) {
      try {
        const profiles = await base44.entities.SchoolProfile.list();
        if (profiles.length > 0) setSchoolProfile(profiles[0]);
      } catch {}
      return;
    }
    try {
      const [currentUser, profiles] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.SchoolProfile.list()
      ]);
      setUser(currentUser);
      if (profiles.length > 0) setSchoolProfile(profiles[0]);
    } catch (e) {
      try {
        const profiles = await base44.entities.SchoolProfile.list();
        if (profiles.length > 0) setSchoolProfile(profiles[0]);
      } catch {}
    }
  };

  if (NO_LAYOUT_PAGES.includes(currentPageName)) {
    return <AcademicYearProvider>{children}</AcademicYearProvider>;
  }

  // Pages students are allowed to visit via layout
  const STUDENT_ALLOWED_PAGES = ['Quiz', 'Results', 'Notices', 'Gallery', 'Calendar', 'Diary', 'More'];

  // If student session exists and NOT on an allowed page, redirect instantly
  if (studentSession && !STUDENT_ALLOWED_PAGES.includes(currentPageName)) {
    // Use React Router navigation for instant client-side redirect (no page reload)
    window.location.replace(createPageUrl('StudentDashboard'));
    return null;
  }

  // If student is on an allowed page, render with student bottom nav (no staff layout)
  if (studentSession && STUDENT_ALLOWED_PAGES.includes(currentPageName)) {
    return (
      <AcademicYearProvider>
        <div className="min-h-screen bg-gray-100 flex flex-col max-w-md mx-auto relative pb-20">
          <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
            <div className="flex items-center gap-2">
              <img
                src={schoolProfile?.logo_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg'}
                alt="Logo"
                className="h-9 w-9 object-contain rounded-full bg-white p-0.5 flex-shrink-0 shadow"
              />
              <span className="font-bold text-base tracking-tight leading-tight">
                {schoolProfile?.school_name || 'BVM School of Excellence'}
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
          <StudentBottomNav currentPage={currentPageName} />
        </div>
      </AcademicYearProvider>
    );
  }

  return (
    <AcademicYearProvider>
      <MessageNotificationListener />
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col w-full overflow-x-hidden" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Top Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-3 sm:px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md w-full">
        <div className="flex items-center gap-2">
          <img
            src={schoolProfile?.logo_url || 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/30c52e9c7_lOGO.jpeg'}
            alt="Logo"
            className="h-9 w-9 object-contain rounded-full bg-white p-0.5 flex-shrink-0 shadow"
          />
          <span className="font-bold text-base tracking-tight leading-tight">
            {schoolProfile?.school_name || 'BVM School of Excellence'}
          </span>
        </div>
        <AcademicYearSelector />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50 shadow-lg">
        <div className="flex items-center justify-around py-2">
          {bottomNav.map((item) => {
            const isActive = currentPageName === item.page;
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
                  {item.name}
                </span>
                {isActive && (
                  <div className="w-1 h-1 rounded-full bg-[#1a237e] mt-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
    </AcademicYearProvider>
  );
}