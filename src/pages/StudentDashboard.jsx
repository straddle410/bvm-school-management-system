import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Home, LogOut, BookOpen, ClipboardList, Bell, Trophy,
  ChevronRight, Lock, Image, Calendar, Brain, FileText, Book,
  MessageSquare, TrendingUp, CheckCircle, AlertCircle, Clock,
  Ticket, BarChart3, Sun, Moon, Wallet, User
} from 'lucide-react';
import { useDarkMode } from '@/components/useDarkMode';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StudentNotificationHub from '@/components/StudentNotificationHub';
import LiveBusMap from '@/components/LiveBusMap';
import { clearSession } from '@/components/sessionHelper';

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

// IMPORTANT:
// Always use createPageUrl('StudentPageName').
// Do NOT use lowercase routes like '/studentattendance'.
// Base44 routes are case-sensitive and generated from filenames.
const HOME_TILES = [
  { label: 'Attendance', page: 'StudentAttendance', icon: ClipboardList, color: '#2e7d32', bg: '#e8f5e9', notifKey: null },
  { label: 'Diary', page: 'StudentDiary', icon: Book, color: '#c2185b', bg: '#fce4ec', notifKey: 'Diary' },
  { label: 'Notices', page: 'StudentNotices', icon: Bell, color: '#283593', bg: '#e8eaf6', notifKey: 'Notices' },
  { label: 'Homework', page: 'StudentHomework', icon: BookOpen, color: '#e65100', bg: '#fff3e0', notifKey: 'Homework' },
  { label: 'Timetable', page: 'StudentTimetable', icon: Calendar, color: '#6a1b9a', bg: '#f3e5f5', notifKey: null },
  { label: 'Messages', page: 'StudentMessaging', icon: MessageSquare, color: '#0277bd', bg: '#e1f5fe', notifKey: 'Messages' },
  { label: 'Fees', page: 'StudentFees', icon: Wallet, color: '#c62828', bg: '#ffebee', notifKey: null },
  { label: 'Gallery', page: 'Gallery', icon: Image, color: '#f57f17', bg: '#fff8e1', notifKey: null },
  { label: 'Hall Ticket', page: 'StudentHallTicketView', icon: Ticket, color: '#00695c', bg: '#e0f2f1', notifKey: 'HallTickets' },
  { label: 'Marks', page: 'StudentMarks', icon: BarChart3, color: '#1565c0', bg: '#e3f2fd', notifKey: 'Marks' },
  { label: 'Quiz', page: 'StudentQuiz', icon: Brain, color: '#4527a0', bg: '#ede7f6', notifKey: 'Quiz' },
  { label: 'Profile', page: 'StudentProfile', icon: User, color: '#37474f', bg: '#eceff1', notifKey: null },
];

export default function StudentDashboard() {
  const [student, setStudent] = useState(null);
  const [pullY, setPullY] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartY = useRef(0);
  const [isDark, setIsDark] = useDarkMode();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const session = getStudentSession();
    if (!session) { window.location.href = createPageUrl('StudentLogin'); return; }
    if (session.must_change_password) {
      window.location.href = createPageUrl('StudentChangePassword') + '?forced=1';
      return;
    }

    // Clear stale query cache on mount to prevent old student data from showing
    queryClient.clear();

    // Verify the student still exists in DB and is not deleted
    const verifyStudent = async () => {
      try {
        const results = await base44.entities.Student.filter(
          { student_id: session.student_id, is_deleted: false },
          'student_id',
          1
        );
        if (!results || results.length === 0) {
          clearSession('student_session');
          window.location.replace(createPageUrl('StudentLogin'));
          return;
        }
        const latestStudent = results[0];
        if (latestStudent.status === 'Archived' || latestStudent.status === 'Transferred') {
          clearSession('student_session');
          window.location.replace(createPageUrl('StudentLogin'));
          return;
        }
      } catch (e) {
        console.error('Student verification error:', e);
      }
    };
    verifyStudent();

    setStudent(session);

    // Refresh student data from DB to pick up transport/other changes made after login
    base44.entities.Student.filter({ student_id: session.student_id, is_deleted: false }, 'student_id', 1)
      .then(results => { if (results?.[0]) setStudent(s => ({ ...s, ...results[0] })); })
      .catch(() => {});

    const params = new URLSearchParams(window.location.search);
    if (params.get('openFees') === '1') {
      const receiptNo = params.get('receiptNo');
      const target = receiptNo
        ? `${createPageUrl('StudentFees')}?receiptNo=${receiptNo}`
        : createPageUrl('StudentFees');
      navigate(target, { replace: true });
    }
  }, []);

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    await queryClient.invalidateQueries();
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  const handleTouchStart = (e) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (scrollTop > 0) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullY(Math.min(delta * 0.4, 80));
  };

  const handleTouchEnd = () => {
    if (pullY >= 60) handleRefresh();
    setPullY(0);
  };

  // Attendance % — defer to 2s after render to not block initial page load
  const [enableAttendance, setEnableAttendance] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEnableAttendance(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const { data: attendData } = useQuery({
    queryKey: ['student-attendance-pct', student?.student_id],
    queryFn: async () => {
      const [years, students] = await Promise.all([
        base44.entities.AcademicYear.filter({ year: student.academic_year }).catch(() => []),
        base44.entities.Student.filter({ student_id: student.student_id }).catch(() => [])
      ]);
      const academicYearStart = years?.[0]?.start_date || new Date().toISOString().split('T')[0];
      const effectiveStartDate = students?.[0]?.admission_date || academicYearStart;
      const endDate = new Date().toISOString().split('T')[0];
      const res = await base44.functions.invoke('calculateAttendanceSummaryForStudent', {
        student_id: student.student_id,
        academic_year: student.academic_year,
        start_date: effectiveStartDate,
        end_date: endDate
      });
      return res.data || {};
    },
    enabled: enableAttendance && !!student?.student_id,
    staleTime: 5 * 60 * 1000,
  });

  // Current academic year — defer to 1s after render
  const [enableAcademicYear, setEnableAcademicYear] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEnableAcademicYear(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const { data: currentYearData } = useQuery({
    queryKey: ['current-academic-year'],
    queryFn: () => base44.entities.AcademicYear.filter({ is_current: true }).then(d => d[0] || null),
    enabled: enableAcademicYear,
    staleTime: 10 * 60 * 1000,
  });

  // School profile — defer to 1.5s after render
  const [enableSchoolProfile, setEnableSchoolProfile] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setEnableSchoolProfile(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => base44.entities.SchoolProfile.list().then(d => d[0] || null),
    enabled: enableSchoolProfile,
    staleTime: 30 * 60 * 1000,
  });

  const attendancePct = attendData?.percentage ? Math.round(attendData.percentage) : 0;
  const currentYear = currentYearData?.year || null;

  const handleLogout = () => {
    clearSession('student_session');
    window.location.replace(createPageUrl('StudentLogin'));
  };

  const { data: unreadCounts = {}, refetch: refetchUnread } = useQuery({
    queryKey: ['unread-counts', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return {};
      // Fetch both notifications and direct messages in parallel
      const [notifs, unreadMsgs] = await Promise.all([
        base44.entities.Notification.filter({ recipient_student_id: student.student_id, is_read: false }),
        base44.entities.Message.filter({ recipient_id: student.student_id, is_read: false }),
      ]);
      const counts = { Notices: 0, Diary: 0, Quiz: 0, Messages: 0, Results: 0, HallTickets: 0, Homework: 0, Marks: 0 };
      for (const n of notifs) {
        if (n.type === 'notice_posted') counts.Notices++;
        else if (n.type === 'diary_published') counts.Diary++;
        else if (n.type === 'quiz_posted') counts.Quiz++;
        else if (n.type === 'class_message') counts.Messages++;
        else if (n.type === 'marks_published') counts.Marks++;
        else if (n.type === 'results_posted') counts.Results++;
        else if (n.type === 'hall_ticket_published') counts.HallTickets++;
        else if (n.type === 'homework_published') counts.Homework++;
      }
      counts.Messages += unreadMsgs.length;
      return counts;
    },
    enabled: !!student?.student_id,
    refetchInterval: 30000,
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Real-time: re-fetch badge counts when any notification is created
  useEffect(() => {
    if (!student?.student_id) return;
    const unsub1 = base44.entities.Notification.subscribe((event) => {
      if (event.type === 'create' && event.data?.recipient_student_id === student.student_id) {
        refetchUnread();
      }
    });
    const unsub2 = base44.entities.Message.subscribe((event) => {
      if (event.type === 'create' && event.data?.recipient_id === student.student_id) {
        refetchUnread();
      }
    });
    // Immediate refresh when any student page marks notifications as read
    const handleNotificationsRead = () => refetchUnread();
    window.addEventListener('student-notifications-read', handleNotificationsRead);
    return () => {
      unsub1();
      unsub2();
      window.removeEventListener('student-notifications-read', handleNotificationsRead);
    };
  }, [student?.student_id]);

  const totalUnread = Object.values(unreadCounts).reduce((s, v) => s + v, 0);

  const notifMap = {
    Diary: unreadCounts.Diary || 0,
    Quiz: unreadCounts.Quiz || 0,
    Notices: unreadCounts.Notices || 0,
    Results: unreadCounts.Results || 0,
    Messages: unreadCounts.Messages || 0,
    HallTickets: unreadCounts.HallTickets || 0,
    Homework: unreadCounts.Homework || 0,
    Marks: unreadCounts.Marks || 0,
  };

  if (!student) return null;

  const initials = student.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-[#f0f4ff] dark:bg-gray-950 flex flex-col relative">
      {/* Unified Notification Hub */}
      <StudentNotificationHub studentSession={student} />



      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-3 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            {schoolProfile?.logo_url ? (
              <img
                src={schoolProfile?.logo_url}
                alt="School Logo"
                className="h-10 w-10 object-contain rounded-full bg-white p-0.5 flex-shrink-0 shadow"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Home className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="leading-tight min-w-0">
              <p className="font-bold text-sm leading-tight truncate">{schoolProfile?.school_name || 'BVM School'}</p>
              <p className="text-blue-200 text-xs">Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to={createPageUrl('StudentNotifications')} className="relative p-1.5 hover:bg-white/20 rounded-lg transition-all">
              <Bell className="h-5 w-5 text-white" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsDark(v => !v)}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-all"
            >
              {isDark ? <Sun className="h-5 w-5 text-yellow-300" /> : <Moon className="h-5 w-5 text-white/80" />}
            </button>
          </div>
        </div>
      </header>


      {/* Student Info Card */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{student?.name}</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">Class {student?.class_name}-{student?.section} | ID: {student?.student_id}</p>
          <div className="flex items-center justify-between mt-3">
            <span className="text-sm font-bold text-gray-800 dark:text-slate-200">{currentYear || student?.academic_year || '—'}</span>
            <span className={`text-sm font-bold ${attendancePct >= 75 ? 'text-green-600' : 'text-red-500'}`}>{attendancePct}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 mt-1.5">
            <div
              className={`h-2 rounded-full transition-all ${attendancePct >= 75 ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(attendancePct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Attendance</p>
        </div>
      </div>

      <main
        className="flex-1 overflow-y-auto pb-24 px-4 pt-3"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullY > 0 ? pullY : (isRefreshing ? 48 : 0) }}
        >
          <div className={`flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-semibold ${isRefreshing ? 'animate-pulse' : ''}`}>
            <div className={`w-5 h-5 border-2 border-indigo-400 border-t-indigo-700 rounded-full ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : pullY >= 60 ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>

        {/* MY CLASSES section */}
        <section>
          <h2 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-3">My Classes</h2>
          <div className="grid grid-cols-2 gap-3">
            {HOME_TILES.map((tile) => {
               const badge = notifMap[tile.notifKey] || 0;
               return (
                 <Link key={tile.label} to={createPageUrl(tile.page)} className="relative">
                  <div className="rounded-2xl px-3 py-3 shadow-sm flex flex-col items-start justify-end gap-2 min-h-[85px] active:scale-95 transition-transform" style={{ backgroundColor: tile.color }}>
                    <tile.icon className="h-5 w-5 text-white" strokeWidth={1.8} />
                    <p className="font-bold text-white text-sm leading-tight">{tile.label}</p>
                    {badge > 0 && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 shadow">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </div>
                </Link>
               );
             })}
          </div>
        </section>

        {/* Live Bus Tracking */}
        {student?.transport_enabled && student?.transport_route_id && (
          <section className="mt-5">
            <h2 className="text-xs font-bold text-gray-500 dark:text-slate-400 uppercase tracking-widest mb-3">Live Bus Tracking</h2>
            <LiveBusMap routeId={student.transport_route_id} />
          </section>
        )}

        {/* Logout */}
        <div className="mt-6 mb-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-red-200 text-red-600 font-bold text-sm bg-white dark:bg-slate-800 dark:border-red-800 dark:text-red-400 active:scale-95 transition-transform"
          >
            <LogOut className="h-5 w-5" />
            Logout
          </button>
        </div>
      </main>
    </div>
  );
}