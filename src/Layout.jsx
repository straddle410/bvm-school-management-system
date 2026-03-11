import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { Home, Bell, Image as ImageIcon, Calendar, MoreHorizontal, Building2, ArrowLeft, BookOpen, ClipboardCheck, Wallet, BarChart3, TrendingUp, User } from 'lucide-react';
import { useApprovalsCount } from '@/components/ApprovalsCountBadge';
import { AcademicYearProvider, useAcademicYear } from '@/components/AcademicYearContext';
import AcademicYearSelector from '@/components/AcademicYearSelector';
import StudentBottomNav from '@/components/StudentBottomNav';
import MessageNotificationListener from '@/components/messaging/MessageNotificationListener';
import { getProxiedImageUrl } from '@/components/imageProxy';
import StudentAuthGuard from '@/components/StudentAuthGuard';
import StaffAuthGuard from '@/components/StaffAuthGuard';

// Don't register here - let StudentNotificationSettings handle it on user request

const getBottomNav = (isAdmin, userRole) => {
  if (userRole === 'accountant') {
    return [
      { name: 'Home',        icon: Home,          page: 'Dashboard' },
      { name: 'Fees',        icon: Wallet,        page: 'Fees' },
      { name: 'Collection',  icon: BarChart3,     page: 'CollectionReport' },
      { name: 'Due',         icon: TrendingUp,    page: 'OutstandingReport' },
      { name: 'Ledger',      icon: BookOpen,      page: 'StudentLedgerReport' },
      { name: 'More',        icon: MoreHorizontal,page: 'More' },
    ];
  }
  if (userRole === 'exam_staff') {
    return [
      { name: 'Home',       icon: Home,          page: 'Dashboard' },
      { name: 'Attendance', icon: ClipboardCheck, page: 'Attendance' },
      { name: 'Marks',      icon: BookOpen,       page: 'Marks' },
      { name: 'Exams',      icon: Calendar,       page: 'ExamManagement' },
      { name: 'More',       icon: MoreHorizontal, page: 'More' },
    ];
  }
  return [
    { name: 'Home', icon: Home, page: 'Dashboard' },
    { name: 'Notices', icon: Bell, page: 'Notices' },
    { name: 'Gallery', icon: ImageIcon, page: 'Gallery' },
    ...(isAdmin ? [{ name: 'Approvals', icon: ClipboardCheck, page: 'Approvals' }] : [{ name: 'Calendar', icon: Calendar, page: 'Calendar' }]),
    { name: 'More', icon: MoreHorizontal, page: 'More' },
  ];
};


const LogoWithFallback = ({ src, alt, schoolProfile }) => {
  const [imgError, setImgError] = useState(false);
  const logoUrl = src || schoolProfile?.logo_url;
  const proxiedLogoUrl = getProxiedImageUrl(logoUrl);
  return imgError || !logoUrl ?
  <div className="h-9 w-9 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow">
      <Building2 className="h-5 w-5 text-[#1a237e]" />
    </div> :

  <img src={proxiedLogoUrl} alt={alt} className="h-9 w-9 object-contain rounded-full bg-white p-0.5 flex-shrink-0 shadow" onError={() => setImgError(true)} />;

};

// Pages that don't use the app shell
const NO_LAYOUT_PAGES = ['Index', 'index', 'Home', 'PublicAdmission', 'StaffLogin', 'StudentLogin', 'StudentDashboard', 'StudentHomework', 'StudentMessaging', 'UserProfile', 'PrintReceiptA5'];

// Pages students CAN visit through the layout (using bottom nav)
const STUDENT_ALLOWED_PAGES = ['Dashboard', 'Notices', 'Gallery', 'Calendar', 'Quiz', 'Results', 'More'];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [studentSession, setStudentSession] = useState(() => {
    try { const raw = localStorage.getItem('student_session'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userRole, setUserRole] = useState('');
  const { academicYear } = useAcademicYear();
  const approvalsCount = useApprovalsCount(academicYear, isAdmin);

  useEffect(() => {
    // Root route is handled by pages/Index.js which does session-based restore

    // Check student session first
    let ss = null;
    try {
      const raw = localStorage.getItem('student_session');
      if (raw) {ss = JSON.parse(raw);setStudentSession(ss);}
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

    // Staff session in localStorage is the AUTHORITATIVE source for role/nav.
    // base44.auth.me() may return a different role — do NOT overwrite staff role.
    let staffRoleFromSession = '';
    try {
      const staffRaw = localStorage.getItem('staff_session');
      if (staffRaw) {
        const staffUser = JSON.parse(staffRaw);
        staffRoleFromSession = (staffUser.role || '').toLowerCase();
        setUserRole(staffRoleFromSession);
        setIsAdmin(staffRoleFromSession === 'admin' || staffRoleFromSession === 'principal');
        setUser(staffUser);
      }
    } catch {}

    try {
      const profiles = await base44.entities.SchoolProfile.list();
      if (profiles.length > 0) setSchoolProfile(profiles[0]);
    } catch {}

    // Only use auth.me() role if no staff session exists
    if (!staffRoleFromSession) {
      try {
        const currentUser = await base44.auth.me().catch(() => null);
        if (currentUser) {
          currentUser.role = (currentUser.role || '').toLowerCase();
          setIsAdmin(currentUser.role === 'admin' || currentUser.role === 'principal');
          setUserRole(currentUser.role || '');
          setUser(currentUser);
        }
      } catch {}
    }
  };

  if (NO_LAYOUT_PAGES.includes(currentPageName)) {
    return <AcademicYearProvider>{children}</AcademicYearProvider>;
  }

  // Pages students are allowed to visit via layout
  const STUDENT_ALLOWED_PAGES = ['StudentAttendance', 'StudentMarks', 'StudentDiary', 'StudentNotices', 'StudentTimetable', 'StudentHomework', 'StudentMessaging', 'StudentHallTicketView', 'StudentMore', 'StudentFees', 'Results', 'Quiz', 'Gallery', 'StudentProfile', 'StudentNotifications'];

  // If student is on an allowed page, render with student bottom nav (no staff layout)
  if (studentSession && STUDENT_ALLOWED_PAGES.includes(currentPageName)) {
    return (
      <AcademicYearProvider>
        <div className="min-h-screen bg-gray-100 flex flex-col relative pb-20">
          <main className="flex-1 overflow-y-auto">
            <StudentAuthGuard currentPageName={currentPageName}>
              {children}
            </StudentAuthGuard>
          </main>
          <StudentBottomNav currentPage={currentPageName} />
        </div>
      </AcademicYearProvider>);

  }

  return (
    <AcademicYearProvider>
      <MessageNotificationListener />
      <StaffAuthGuard currentPageName={currentPageName}>
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col w-full" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Top Header */}
      <header className="no-print bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-2 sm:px-4 flex items-center justify-between sticky top-0 z-50 shadow-md w-full relative min-h-14 py-2">
        {currentPageName !== 'Dashboard' && (
          <button onClick={() => navigate(-1)} className="hover:bg-white/20 p-1 rounded-lg transition flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <LogoWithFallback src={schoolProfile?.logo_url} alt="Logo" />
          <div className="flex flex-col min-w-0">
            <span className="font-bold text-sm sm:text-base tracking-tight leading-tight truncate">
              {schoolProfile?.school_name || 'BVM School'}
            </span>
            {!studentSession && <span className="text-[10px] sm:text-xs text-white/70">Staff Portal</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
          <AcademicYearSelector />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        <StaffAuthGuard currentPageName={currentPageName}>
          {children}
        </StaffAuthGuard>
      </main>

      {/* Bottom Navigation */}
      <nav className="no-print fixed bottom-0 left-0 right-0 w-full bg-white border-t border-gray-200 z-50 shadow-lg">
        <div className="flex items-center justify-around py-1 overflow-x-auto">
          {getBottomNav(isAdmin, userRole).map((item) => {
              const isActive = currentPageName === item.page;
              const href = item.tab ? `${createPageUrl(item.page)}?tab=${item.tab}` : createPageUrl(item.page);
              return (
                <Link
                  key={item.name}
                  to={href}
                  className={`flex flex-col items-center gap-0.5 px-1 py-2 rounded-xl transition-all relative flex-1 min-w-[48px] min-h-[48px] justify-center ${
                  isActive ? 'text-[#1a237e]' : 'text-gray-400'}`}>
                  <item.icon className={`${userRole === 'accountant' ? 'h-6 w-6' : 'h-6 w-6'} ${isActive ? 'text-[#1a237e]' : 'text-gray-400'}`} />
                  <span className={`text-[10px] font-medium text-center leading-tight ${isActive ? 'text-[#1a237e]' : 'text-gray-400'}`}>
                    {item.name}
                  </span>
                  {isActive && <div className="w-1 h-1 rounded-full bg-[#1a237e] mt-0.5" />}
                </Link>);
            })}
        </div>
        </nav>
        </div>
        </StaffAuthGuard>
        </AcademicYearProvider>);

}