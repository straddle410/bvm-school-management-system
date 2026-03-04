import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PushNotificationManager from '@/components/PushNotificationManager';
import { useStaffNotificationBadges } from '@/components/StaffNotificationBadges';
import ExamResultsModal from '@/components/exam/ExamResultsModal';
import {
  GraduationCap, Image, Calendar, Brain, Bell, MoreHorizontal, Home,
  ClipboardList, Megaphone, ChevronRight, User, BarChart3, Check,
  FileText, Award, BookOpen, Palmtree, Clock, Book, BookMarked, NotebookPen, LogOut,
  CheckCircle, AlertCircle, MessageSquare, Trophy, Mail, Users, Building2, TrendingUp, BarChart4, ClipboardCheck, UserCheck, Wallet
} from 'lucide-react';
import { format } from 'date-fns';

import { getProxiedImageUrl } from '@/components/imageProxy';
import ApprovalsCountBadge, { useApprovalsCount } from '@/components/ApprovalsCountBadge';
import { useAcademicYear } from '@/components/AcademicYearContext';

const LogoImageWithFallback = ({ src, alt }) => {
  const [imgError, setImgError] = useState(false);
  const proxiedSrc = getProxiedImageUrl(src);
  return imgError || !src ? (
    <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow">
      <Building2 className="h-5 w-5 text-[#1a237e]" />
    </div>
  ) : (
    <img src={proxiedSrc} alt={alt} className="h-8 w-8 rounded-full object-contain bg-white p-0.5 shadow" onError={() => setImgError(true)} />
  );
};

const DEFAULT_BANNERS = [
  { url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80', caption: 'Science Exhibition Winners - Proud Moments' },
  { url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80', caption: 'Annual Day Celebrations 2024' },
  { url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80', caption: 'Sports Day - Champions at Heart' },
];

const quickAccess = [
  { label: 'Results',       icon: GraduationCap, gradient: 'from-indigo-400 to-indigo-600',   page: 'Results' },
  { label: 'Gallery',       icon: Image,         gradient: 'from-fuchsia-400 to-pink-500',    page: 'Gallery' },
  { label: 'Calendar',      icon: Calendar,      gradient: 'from-teal-400 to-emerald-500',    page: 'Calendar' },
  { label: 'Quiz',          icon: Brain,         gradient: 'from-purple-400 to-violet-600',   page: 'Quiz' },
  { label: 'Notices',       icon: Bell,          gradient: 'from-sky-400 to-blue-500',        page: 'Notices' },
  { label: 'Messages',      icon: Mail,          gradient: 'from-green-400 to-emerald-500',   page: 'Messaging', staffOnly: true },
  { label: 'Diary',         icon: BookMarked,    gradient: 'from-pink-400 to-rose-500',       page: 'Diary' },
  { label: 'Admissions',    icon: FileText,      gradient: 'from-lime-400 to-green-500',      page: 'AdmissionLanding', guestOnly: true },
  { label: 'Student Login', icon: User,          gradient: 'from-orange-400 to-amber-500',    page: 'StudentLogin', guestOnly: true },
];

// quickActions now uses permission-aware filtering in the component
// roleRequired uses lowercase for consistent matching after normalization
const quickActions = [
  { label: 'Students',            icon: Users,         gradient: 'from-emerald-400 to-teal-600',  page: 'Students',               permKey: null,                          roleRequired: ['teacher', 'staff'] },
  { label: 'Attendance',          icon: Check,         gradient: 'from-blue-400 to-blue-600',     page: 'Attendance',             permKey: 'attendance',                  roleRequired: ['admin', 'principal', 'teacher'] },
  { label: 'Post',                icon: NotebookPen,   gradient: 'from-purple-400 to-pink-600',   page: 'PostingDashboard',       permKey: null,                          roleRequired: ['admin', 'principal', 'teacher'] },
  { label: 'Marks Entry',         icon: ClipboardList, gradient: 'from-cyan-400 to-teal-500',     page: 'Marks',                  permKey: 'marks',                       roleRequired: ['admin', 'principal', 'teacher'] },
  { label: 'Messages',            icon: Mail,          gradient: 'from-green-400 to-emerald-500', page: 'Messaging',              permKey: null,                          roleRequired: ['admin', 'principal', 'teacher'] },
  { label: 'Manage Admissions',   icon: UserCheck,     gradient: 'from-indigo-400 to-purple-600', page: 'Admissions',             permKey: 'student_admission_permission', roleRequired: ['admin', 'principal'] },
  { label: 'Timetable',           icon: Clock,         gradient: 'from-sky-400 to-indigo-500',    page: 'TimetableManagement',    permKey: null,                          roleRequired: ['admin', 'principal'] },
  // Fees tiles — visible to any staff with the respective permission (permKey required, so always gated)
  { label: 'Fees',                icon: Wallet,        gradient: 'from-green-400 to-emerald-600', page: 'Fees',                   permKey: 'fees_view_module',            roleRequired: ['admin', 'principal', 'accountant', 'staff', 'teacher'] },
  { label: 'Collection',          icon: BarChart3,     gradient: 'from-sky-400 to-blue-600',      page: 'CollectionReport',       permKey: 'fee_reports_view',            roleRequired: ['admin', 'principal', 'accountant', 'staff', 'teacher'] },
  { label: 'Outstanding',         icon: TrendingUp,    gradient: 'from-red-400 to-rose-600',      page: 'OutstandingReport',      permKey: 'fee_reports_view',            roleRequired: ['admin', 'principal', 'accountant', 'staff', 'teacher'] },
  { label: 'Ledger',              icon: BookOpen,      gradient: 'from-violet-400 to-purple-600', page: 'StudentLedgerReport',    permKey: 'fees_view_ledger',            roleRequired: ['admin', 'principal', 'accountant', 'staff', 'teacher'] },
];

// Finance tiles for accountant role — permission-gated
const accountantFinanceActions = [
  { label: 'Fees',           icon: Wallet,      gradient: 'from-green-400 to-emerald-600', page: 'Fees',                permKey: 'fees_view_module' },
  { label: 'Additional Fee', icon: AlertCircle, gradient: 'from-orange-400 to-amber-500',  page: 'Fees', tab: 'adhoc', permKey: 'fees_apply_charge' },
  { label: 'Collection',     icon: BarChart3,   gradient: 'from-sky-400 to-blue-600',      page: 'CollectionReport',    permKey: 'fee_reports_view' },
  { label: 'Outstanding',    icon: TrendingUp,  gradient: 'from-red-400 to-rose-600',      page: 'OutstandingReport',   permKey: 'fee_reports_view' },
  { label: 'Ledger',         icon: BookOpen,    gradient: 'from-violet-400 to-purple-600', page: 'StudentLedgerReport', permKey: 'fees_view_ledger' },
  { label: 'Daily Closing',  icon: FileText,    gradient: 'from-cyan-400 to-teal-600',     page: 'DailyClosingReport',  permKey: 'fee_reports_view' },
  { label: 'Defaulters',     icon: Users,       gradient: 'from-rose-400 to-red-600',      page: 'DefaultersReport',    permKey: 'fee_reports_view' },
  { label: 'Discount',       icon: Award,       gradient: 'from-amber-400 to-yellow-500',  page: 'Reports',             permKey: 'fee_reports_view' },
  { label: 'Day Book',       icon: BookMarked,  gradient: 'from-indigo-400 to-indigo-600', page: 'DayBookReport',       permKey: 'fee_reports_view' },
];

const adminActions = [
   { label: 'Students',         icon: Users,         gradient: 'from-emerald-400 to-teal-600',   page: 'Students' },
   { label: 'Staff',            icon: Users,         gradient: 'from-blue-400 to-indigo-600',    page: 'Staff' },
   { label: 'Approvals',        icon: ClipboardCheck, gradient: 'from-orange-400 to-red-600',     page: 'Approvals' },
   { label: 'Fees',             icon: Wallet,        gradient: 'from-green-400 to-emerald-600',  page: 'Fees' },
   { label: 'Collection',       icon: BarChart3,     gradient: 'from-sky-400 to-blue-600',      page: 'CollectionReport' },
   { label: 'Outstanding',      icon: BarChart3,     gradient: 'from-red-400 to-rose-600',       page: 'OutstandingReport' },
   { label: 'Ledger',           icon: BookOpen,      gradient: 'from-violet-400 to-purple-600',  page: 'StudentLedgerReport' },
   { label: 'Analytics',        icon: BarChart3,     gradient: 'from-teal-400 to-cyan-600',     page: 'Reports' },
];

const examModuleActions = [
   { label: 'Hall Tickets',     icon: FileText,      gradient: 'from-red-400 to-rose-600',      page: 'HallTicketManagement' },
   { label: 'Marks Entry',      icon: ClipboardList, gradient: 'from-cyan-400 to-teal-500',     page: 'Marks' },
   { label: 'Results',          icon: GraduationCap, gradient: 'from-indigo-400 to-indigo-600', page: 'Results' },
   { label: 'Progress Cards',   icon: Award,         gradient: 'from-amber-400 to-orange-500',  page: 'ExamManagement', tab: 'progress-cards' },
];

function GradientIcon({ gradient, icon: Icon, size = 'md' }) {
  const s = size === 'sm' ? 'w-12 h-12' : 'w-14 h-14';
  const i = size === 'sm' ? 'h-5 w-5' : 'h-6 w-6';
  return (
    <div className={`${s} rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md`}>
      <Icon className={`${i} text-white`} />
    </div>
  );
}

export default function Dashboard() {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [user, setUser] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [examResultsModalOpen, setExamResultsModalOpen] = useState(false);
  const { academicYear } = useAcademicYear();

  useEffect(() => {
    const staffRaw = localStorage.getItem('staff_session');
    const studentRaw = localStorage.getItem('student_session');
    if (staffRaw) {
      try { setUser(JSON.parse(staffRaw)); } catch {}
    } else if (studentRaw) {
      try { setUser(JSON.parse(studentRaw)); } catch {}
    }
    // Load school profile for logo
    base44.entities.SchoolProfile.list().catch(() => {}).then(p => { if (p?.length > 0) setSchoolProfile(p[0]); });
  }, []);

  const { data: bannerSlides = [] } = useQuery({
    queryKey: ['banner-slides'],
    queryFn: async () => {
      try { return await base44.entities.BannerSlide.filter({ is_active: true }, 'sort_order'); } catch { return []; }
    },
    staleTime: 10 * 60 * 1000,
  });

  const banners = bannerSlides.length > 0
    ? bannerSlides.map(s => ({ url: s.image_url, caption: s.caption }))
    : DEFAULT_BANNERS;

  useEffect(() => {
    const timer = setInterval(() => setBannerIndex(i => (i + 1) % (banners.length || 1)), 3500);
    return () => clearInterval(timer);
  }, [banners.length]);

  const { data: notices = [] } = useQuery({
    queryKey: ['notices-published'],
    queryFn: async () => {
      try { return await base44.entities.Notice.filter({ status: 'Published' }, '-created_date', 10); } catch { return []; }
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events-published'],
    queryFn: async () => {
      try { return await base44.entities.CalendarEvent.filter({ status: 'Published' }, 'start_date', 20); } catch { return []; }
    },
    staleTime: 5 * 60 * 1000,
  });

  // Only fetch unread diary count for students (not staff)
  const isStudentUser = !!user?.student_id;
  const { data: unreadDiaryCount = 0 } = useQuery({
    queryKey: ['unread-diary-count', user?.student_id],
    queryFn: async () => {
      if (!isStudentUser) return 0;
      try {
        const n = await base44.entities.Notification.filter({ recipient_student_id: user.student_id, type: 'diary_published', is_read: false });
        return n.length;
      } catch { return 0; }
    },
    enabled: isStudentUser,
    staleTime: 60000,
    refetchInterval: 60000
  });

  const { data: latestDiaries = [] } = useQuery({
    queryKey: ['latest-diaries-dashboard'],
    queryFn: async () => {
      try {
        return await base44.entities.Diary.filter({ status: 'Published' }, '-diary_date', 3);
      } catch { return []; }
    },
    staleTime: 5 * 60 * 1000,
  });

  const recentNotices = [...notices]
   .sort((a, b) => new Date(b.publish_date || b.created_date) - new Date(a.publish_date || a.created_date))
   .slice(0, 4);

  const upcomingEvents = events
    .filter(e => new Date(e.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 3);

  const userRole = (user?.role || '').toLowerCase();
  const isAdmin = userRole === 'admin' || userRole === 'principal';
  const isStaff = user && (isAdmin || ['teacher', 'staff', 'librarian', 'accountant'].includes(userRole));

  const { badges: staffBadges } = useStaffNotificationBadges(isStaff ? user?.email : null);
  const unreadMessageCount = staffBadges.Messages || 0;
  // Admin/Principal have all permissions implicitly
  const userPermissions = isAdmin ? new Proxy({}, { get: () => true }) : (user?.permissions || {});
  const approvalsCount = useApprovalsCount(academicYear, isAdmin);

  const { data: yearReport = null } = useQuery({
    queryKey: ['admissions-year-report-badge', academicYear],
    queryFn: async () => {
      if (!isAdmin) return null;
      try {
        const response = await base44.functions.invoke('getAdmissionYearReport', { academicYear });
        return response.data;
      } catch { return null; }
    },
    enabled: isAdmin && !!academicYear,
    staleTime: 60000,
    refetchInterval: 60000
  });

  const pendingApplicationsCount = yearReport?.summary?.total_pending || 0;

  // For non-admin staff, filter quick actions based on their permissions.
  // Permission key takes priority — if an item has a permKey, that permission must be granted.
  // Role-name matching is used only as a fallback for items WITHOUT a permKey.
  const visibleQuickActions = quickActions.filter(item => {
    if (!isStaff) return false;
    if (isAdmin) {
      // Admins see all items regardless of permKey or role
      return true;
    }
    if (item.permKey) {
      // Permission-gated: only show if permission is granted (ignores role name)
      return !!userPermissions[item.permKey];
    }
    // No permKey: fall back to role-name matching
    if (!item.roleRequired) return false;
    return item.roleRequired.some(r => r.toLowerCase() === userRole);
  });

  const eventTypeColor = (type) => {
    const map = { Holiday: '#e53935', Exam: '#7e57c2', PTM: '#1e88e5', Event: '#43a047', Meeting: '#f9a825', General: '#26a69a', Urgent: '#d32f2f', Fee: '#f9a825', Notice: '#1e88e5' };
    return map[type] || '#78909c';
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col w-full overflow-x-hidden relative">
      <PushNotificationManager />
      <ExamResultsModal open={examResultsModalOpen} onOpenChange={setExamResultsModalOpen} />

      {/* Header */}
      <header className="sticky top-0 z-40 w-full">
        <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] px-3 sm:px-4 pt-4 pb-5 shadow-lg">
          {user && (
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold text-lg">Welcome back</h3>
              <button
                onClick={() => { localStorage.removeItem('staff_session'); localStorage.removeItem('student_session'); window.location.reload(); }}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-full transition-all"
              >
                <LogOut className="h-3.5 w-3.5" /> Logout
              </button>
            </div>
          )}

          {user ? (
            <Link to={createPageUrl('UserProfile')} className="flex items-center gap-3 group -mx-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-all">
              <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0 shadow group-hover:bg-white/30 transition-all">
                <span className="text-white font-bold text-lg">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-base leading-tight truncate">{user.full_name || user.name || user.email}</h2>
                <p className="text-blue-200 text-xs capitalize">{user.role || 'Staff'}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-white/50 flex-shrink-0" />
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center">
                <User className="h-6 w-6 text-white/70" />
              </div>
              <div>
                <h2 className="text-white font-bold text-base">Welcome!</h2>
                <p className="text-blue-200 text-xs">Explore school portal</p>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Banner - only for guests (not logged in) */}
      {!user && (
        <div className="relative w-full overflow-hidden" style={{ height: 180 }}>
          {banners.map((img, i) => (
            <div key={i} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: i === bannerIndex ? 1 : 0 }}>
              <img src={img.url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <p className="absolute bottom-3 left-4 right-4 text-white font-semibold text-sm leading-tight">{img.caption}</p>
            </div>
          ))}
          <div className="absolute bottom-2 right-3 flex gap-1.5">
            {banners.map((_, i) => (
              <button key={i} onClick={() => setBannerIndex(i)}
                className={`rounded-full transition-all ${i === bannerIndex ? 'w-5 h-2 bg-yellow-400' : 'w-2 h-2 bg-white/60'}`} />
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-24 px-3 sm:px-4 py-5 space-y-4 sm:space-y-6 w-full">

        {/* Quick Access - hidden for accountant */}
        {userRole !== 'accountant' && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Access</h2>
            <div className="grid grid-cols-4 gap-3">
              {quickAccess
                .filter(item => !(item.guestOnly && user) && !(item.staffOnly && !isStaff) && !(item.label === 'Results' && isAdmin))
                .map((item) => (
                  <Link key={item.label} to={createPageUrl(item.page)} className="block">
                    <div className="flex flex-col items-center gap-1.5 relative">
                      <GradientIcon gradient={item.gradient} icon={item.icon} />
                      {item.label === 'Diary' && unreadDiaryCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                          {unreadDiaryCount > 9 ? '9+' : unreadDiaryCount}
                        </span>
                      )}
                      {item.label === 'Messages' && unreadMessageCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                          {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{item.label}</span>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        )}

        {/* Finance Dashboard - accountant only */}
        {userRole === 'accountant' && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Finance</h2>
            <div className="grid grid-cols-4 gap-3">
              {accountantFinanceActions
                .filter(item => !!userPermissions[item.permKey])
                .map((item) => (
                  <Link key={item.label} to={createPageUrl(item.page)} className="block">
                    <div className="flex flex-col items-center gap-1.5">
                      <GradientIcon gradient={item.gradient} icon={item.icon} />
                      <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{item.label}</span>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        )}

        {/* Quick Actions - staff only, NEVER shown to accountant */}
        {isStaff && userRole !== 'accountant' && visibleQuickActions.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-3">
              {visibleQuickActions.filter(item => !(isAdmin && (item.label === 'Marks Entry' || item.label === 'Messages'))).map((item) => (
                   <Link key={item.label} to={createPageUrl(item.page)} className="block">
                    <div className="flex flex-col items-center gap-1.5 relative">
                      <GradientIcon gradient={item.gradient} icon={item.icon} />
                      {item.label === 'Messages' && unreadMessageCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                          {unreadMessageCount > 9 ? '9+' : unreadMessageCount}
                        </span>
                      )}
                      {item.label === 'Daily Quiz' && (staffBadges.Quiz || 0) > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                          {(staffBadges.Quiz || 0) > 9 ? '9+' : staffBadges.Quiz}
                        </span>
                      )}
                      {item.label === 'Manage Admissions' && pendingApplicationsCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                          {pendingApplicationsCount > 9 ? '9+' : pendingApplicationsCount}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{item.label}</span>
                    </div>
                  </Link>
                ))}
            </div>
          </section>
        )}

        {/* Exam Module */}
        {isAdmin && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Exam Module</h2>
            <div className="grid grid-cols-4 gap-3">
               {examModuleActions.map((item) => {
                 const url = item.tab ? createPageUrl(item.page) + `?tab=${item.tab}` : createPageUrl(item.page);
                 return (
                   <Link key={item.label} to={url} className="block">
                     <div className="flex flex-col items-center gap-1.5">
                       <GradientIcon gradient={item.gradient} icon={item.icon} />
                       <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{item.label}</span>
                     </div>
                   </Link>
                 );
               })}
            </div>
          </section>
        )}

        {/* Admin Tools */}
        {isAdmin && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Admin Tools</h2>
            <div className="grid grid-cols-4 gap-3">
              {adminActions.map((item) => {
                const url = item.href ? item.href : (item.tab ? createPageUrl(item.page) + `?tab=${item.tab}` : createPageUrl(item.page));
                return (
                  <Link key={item.label} to={url} className="block">
                    <div className="flex flex-col items-center gap-1.5 relative">
                      <GradientIcon gradient={item.gradient} icon={item.icon} />
                      {item.label === 'Approvals' && approvalsCount > 0 && (
                        <ApprovalsCountBadge count={approvalsCount} />
                      )}
                      <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{item.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* Latest Diary - hidden for accountant */}
        {userRole !== 'accountant' && latestDiaries.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Latest Diary</h2>
              <Link to={createPageUrl('Diary')} className="flex items-center text-xs text-indigo-600 font-semibold">
                View All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {latestDiaries.map((diary, idx) => (
                <Link to={createPageUrl('Diary')} key={diary.id}>
                  <div className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-pink-500">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-gray-900">{diary.title}</p>
                      {idx === 0 && unreadDiaryCount > 0 && (
                        <span className="bg-red-500 text-white text-[10px] rounded-full px-2 py-0.5 font-bold flex-shrink-0">{unreadDiaryCount} new</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-1">
                      Class {diary.class_name}-{diary.section} · {diary.subject} ·{' '}
                      {diary.diary_date ? format(new Date(diary.diary_date + 'T00:00:00'), 'MMM d, yyyy') : ''}
                    </p>
                    <p className="text-xs text-gray-600 line-clamp-2">{diary.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Notices - hidden for accountant */}
        {userRole !== 'accountant' && recentNotices.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Notices</h2>
              <Link to={createPageUrl('Notices')} className="flex items-center text-xs text-indigo-600 font-semibold">
                View All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentNotices.map((n) => (
                <div key={n.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: eventTypeColor(n.notice_type) }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{n.publish_date ? format(new Date(n.publish_date), 'MMM d, yyyy') : ''}</p>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-1 rounded-full flex-shrink-0"
                    style={{ color: eventTypeColor(n.notice_type), backgroundColor: eventTypeColor(n.notice_type) + '20' }}>
                    {n.notice_type}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Upcoming Events - hidden for accountant */}
        {userRole !== 'accountant' && upcomingEvents.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Upcoming Events</h2>
              <Link to={createPageUrl('Calendar')} className="flex items-center text-xs text-indigo-600 font-semibold">
                View All <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {upcomingEvents.map((e) => (
                <div key={e.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <div className="w-10 h-10 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: eventTypeColor(e.event_type) + '20' }}>
                    <span className="text-[10px] font-bold" style={{ color: eventTypeColor(e.event_type) }}>
                      {e.start_date ? format(new Date(e.start_date), 'MMM') : ''}
                    </span>
                    <span className="text-sm font-bold" style={{ color: eventTypeColor(e.event_type) }}>
                      {e.start_date ? format(new Date(e.start_date), 'd') : ''}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{e.title}</p>
                    <p className="text-xs text-gray-400">{e.event_type}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-gray-200 z-50 shadow-lg">
        <div className="flex items-center justify-around py-2 px-2 sm:px-4">
          {(userRole === 'accountant' ? [
            { name: 'Home', icon: Home, page: 'Dashboard' },
            { name: 'Fees', icon: Wallet, page: 'Fees' },
            { name: 'Collection', icon: BarChart3, page: 'CollectionReport' },
            { name: 'Outstanding', icon: TrendingUp, page: 'OutstandingReport' },
            { name: 'Ledger', icon: BookOpen, page: 'StudentLedgerReport' },
            { name: 'More', icon: MoreHorizontal, page: 'More' },
          ] : [
            { name: 'Home', icon: MoreHorizontal, page: 'Dashboard', adminOnly: false },
            { name: 'Notices', icon: Bell, page: 'Notices', adminOnly: false },
            { name: 'Gallery', icon: Image, page: 'Gallery', adminOnly: false },
            ...(isAdmin ? [{ name: 'Approvals', icon: ClipboardCheck, page: 'Approvals', adminOnly: true }] : [{ name: 'Calendar', icon: Calendar, page: 'Calendar', adminOnly: false }]),
            { name: 'More', icon: MoreHorizontal, page: 'More', adminOnly: false },
          ]).map((item) => {
            const isActive = false;
            return (
              <Link key={item.page} to={createPageUrl(item.page)}
                 className="flex flex-col items-center gap-0.5 px-2 sm:px-3 py-1 rounded-xl transition-all text-gray-400 flex-1 max-w-[80px] sm:max-w-none relative">
                 <item.icon className="h-5 sm:h-6 w-5 sm:w-6" />
                 {item.name === 'Approvals' && approvalsCount > 0 && (
                   <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                     {approvalsCount > 9 ? '9+' : approvalsCount}
                   </span>
                 )}
                 <span className="text-[9px] sm:text-[10px] font-medium text-center leading-tight">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}