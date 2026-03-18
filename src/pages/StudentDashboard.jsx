import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Home, LogOut, BookOpen, ClipboardList, Bell, Trophy,
  ChevronRight, Lock, Image, Calendar, Brain, FileText, Book,
  MessageSquare, TrendingUp, CheckCircle, AlertCircle, Clock,
  Ticket, BarChart3, Sun, Moon
} from 'lucide-react';
import { useDarkMode } from '@/components/useDarkMode';
import StudentBottomNav from '@/components/StudentBottomNav';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import StudentNotificationHub from '@/components/StudentNotificationHub';
import PushNotificationManager from '@/components/PushNotificationManager';
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
  { label: 'Attendance', page: 'StudentAttendance', icon: ClipboardList, color: '#26a69a', bg: '#e0f2f1', notifKey: null },
  { label: 'Marks', page: 'StudentMarks', icon: BarChart3, color: '#1976d2', bg: '#e3f2fd', notifKey: 'Marks' },
  { label: 'Diary', page: 'StudentDiary', icon: Book, color: '#e91e63', bg: '#fce4ec', notifKey: 'Diary' },
  { label: 'Homework', page: 'StudentHomework', icon: BookOpen, color: '#f57c00', bg: '#fff3e0', notifKey: 'Homework' },
  { label: 'Notices', page: 'StudentNotices', icon: Bell, color: '#1a237e', bg: '#e8eaf6', notifKey: 'Notices' },
  { label: 'Hall Ticket', page: 'StudentHallTicketView', icon: Ticket, color: '#388e3c', bg: '#e8f5e9', notifKey: 'HallTickets' },
  { label: 'Timetable', page: 'StudentTimetable', icon: Calendar, color: '#6a1b9a', bg: '#f3e5f5', notifKey: null },
  { label: 'Messages', page: 'StudentMessaging', icon: MessageSquare, color: '#0288d1', bg: '#e1f5fe', notifKey: 'Messages' },
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
    setStudent(session);
    autoRegisterPush(session);

    // Handle notification deep-link: ?openFees=1&receiptNo=XXX
    const params = new URLSearchParams(window.location.search);
    if (params.get('openFees') === '1') {
      const receiptNo = params.get('receiptNo');
      const target = receiptNo
        ? `${createPageUrl('StudentFees')}?receiptNo=${receiptNo}`
        : createPageUrl('StudentFees');
      navigate(target, { replace: true });
    }
  }, []);

  const autoRegisterPush = async (session) => {
    try {
      const studentId = session?.student_id;
      if (!studentId) { console.log('[AutoPush] No student_id in session'); return; }
      if (!('Notification' in window) || !('serviceWorker' in navigator)) { console.log('[AutoPush] Browser does not support push'); return; }

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isPWA = window.matchMedia('(display-mode: standalone)').matches;
      if (isIOS && !isPWA) { console.log('[AutoPush] iOS browser (not PWA) — skipping auto-register'); return; }

      // Check existing pref/token — also re-register if token is stale (raw URL, no keys)
      const prefs = await base44.entities.StudentNotificationPreference.filter({ student_id: studentId });
      const pref = prefs[0];
      if (pref?.browser_push_token) {
        try {
          const parsed = JSON.parse(pref.browser_push_token);
          if (parsed.endpoint && parsed.keys?.p256dh && parsed.keys?.auth) {
            console.log('[AutoPush] Valid token already exists, skipping');
            return;
          }
          console.log('[AutoPush] Existing token is stale/missing keys — re-registering');
        } catch {
          console.log('[AutoPush] Existing token is not valid JSON (raw URL) — re-registering');
        }
      }

      // Request permission (non-blocking — only proceed if granted)
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') { console.log('[AutoPush] Permission not granted:', permission); return; }

      // Register service worker
      const reg = await navigator.serviceWorker.register('/api/functions/firebaseMessagingServiceWorker', { scope: '/' });
      await navigator.serviceWorker.ready;
      console.log('[AutoPush] Service worker ready');

      // Get VAPID key
      const vapidRes = await fetch('/api/functions/getVapidPublicKey');
      const { vapidKey } = await vapidRes.json();
      if (!vapidKey) { console.error('[AutoPush] No VAPID key returned'); return; }
      console.log('[AutoPush] VAPID key prefix:', vapidKey.substring(0, 20) + '...');

      // Convert VAPID key
      const padding = '='.repeat((4 - vapidKey.length % 4) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const applicationServerKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) applicationServerKey[i] = rawData.charCodeAt(i);

      // Always unsubscribe existing subscription and create a fresh one
      // This ensures the subscription matches the current VAPID key and SW
      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        console.log('[AutoPush] Unsubscribing stale subscription...');
        await existingSub.unsubscribe();
      }
      const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      console.log('[AutoPush] New subscription endpoint prefix:', subscription.endpoint.substring(0, 50) + '...');

      const subJson = subscription.toJSON();
      console.log('[AutoPush] Subscription endpoint:', subJson.endpoint?.substring(0, 40) + '...');
      console.log('[AutoPush] Has p256dh:', !!subJson.keys?.p256dh, 'Has auth:', !!subJson.keys?.auth);

      // Save via saveStudentPushToken
      await base44.functions.invoke('saveStudentPushToken', {
        student_id: studentId,
        subscription: subJson,
      });

      console.log('[AutoPush] ✅ Push subscription saved successfully for', studentId);
    } catch (err) {
      console.error('[AutoPush] Failed:', err.message);
    }
  };

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

  // Attendance % — cached 5 min, only fetches when student is ready
  const { data: attendData } = useQuery({
    queryKey: ['student-attendance-pct', student?.student_id],
    queryFn: () => base44.functions.invoke('calculateAttendanceSummaryForStudent', {
      student_id: student.student_id,
      academic_year: student.academic_year
    }).then(r => r.data || {}),
    enabled: !!student?.student_id,
    staleTime: 5 * 60 * 1000,
  });

  // Current academic year — cached 10 min
  const { data: currentYearData } = useQuery({
    queryKey: ['current-academic-year'],
    queryFn: () => base44.entities.AcademicYear.filter({ is_current: true }).then(d => d[0] || null),
    staleTime: 10 * 60 * 1000,
  });

  // School profile — cached 30 min
  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile'],
    queryFn: () => base44.entities.SchoolProfile.list().then(d => d[0] || null),
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
    <div className="min-h-screen bg-white dark:bg-gray-950 flex flex-col relative">
      {/* Unified Notification Hub */}
      <StudentNotificationHub studentSession={student} />

      {/* Push Notification Manager */}
      <PushNotificationManager studentId={student?.student_id} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 md:px-6 py-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4">
            {schoolProfile?.logo_url ? (
              <img
                src={schoolProfile.logo_url}
                alt="School Logo"
                className="h-12 w-12 md:h-14 md:w-14 object-contain rounded-full bg-white p-1 flex-shrink-0 shadow"
              />
            ) : (
              <div className="h-12 w-12 md:h-14 md:w-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Home className="h-7 w-7 md:h-8 md:w-8 text-white" />
              </div>
            )}
            <div className="leading-tight">
              <p className="font-bold text-lg md:text-xl leading-tight">{schoolProfile?.school_name || 'BVM School'}</p>
              <p className="text-blue-100 text-sm md:text-base mt-0.5">Student Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link to={createPageUrl('StudentNotifications')} className="relative p-2.5 md:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center">
              <Bell className="h-6 w-6 md:h-7 md:w-7 text-white" />
              {totalUnread > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs md:text-sm font-bold rounded-full min-w-[20px] h-5 md:h-6 flex items-center justify-center px-0.5">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </Link>
            <button
              onClick={() => setIsDark(v => !v)}
              className="p-2.5 md:p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun className="h-6 w-6 md:h-7 md:w-7 text-yellow-300" /> : <Moon className="h-6 w-6 md:h-7 md:w-7 text-white/80" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm md:text-base font-medium px-3 md:px-4 py-2.5 md:py-3 rounded-full transition-all min-h-[44px]"
            >
              <LogOut className="h-5 w-5" /> Logout
            </button>
          </div>
        </div>
      </header>

      {/* Header Card */}
      <div className="px-4 md:px-6 pt-5 pb-3 dark:bg-gray-900">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 md:p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="min-w-0">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">{student?.name}</h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 mt-1">Class {student?.class_name}-{student?.section} | ID: {student?.student_id}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-base md:text-lg mb-4">
            <span className="text-gray-700 dark:text-gray-300 font-semibold">
              {currentYear || 'Academic year not set'}
            </span>
            <span className={`font-bold text-xl md:text-2xl ${attendancePct >= 75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              {attendancePct}%
            </span>
          </div>
          <div className="mt-3 bg-gray-200 dark:bg-gray-700 rounded-full h-3 md:h-4">
            <div
              className={`h-3 md:h-4 rounded-full transition-all ${attendancePct >= 75 ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-red-500 dark:bg-red-400'}`}
              style={{ width: `${Math.min(attendancePct, 100)}%` }}
            />
          </div>
          <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 mt-3 font-medium">Attendance</p>
        </div>
      </div>

      <main
        className="flex-1 overflow-y-auto pb-24 px-4 md:px-6 space-y-5 dark:bg-gray-950 pt-3"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullY > 0 ? pullY : (isRefreshing ? 48 : 0) }}
        >
          <div className={`flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-base md:text-lg font-semibold ${isRefreshing ? 'animate-pulse' : ''}`}>
            <div className={`w-6 h-6 border-2 border-indigo-400 dark:border-indigo-500 border-t-indigo-700 dark:border-t-indigo-300 rounded-full ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : pullY >= 60 ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>

        {/* Home Tiles (3-column responsive) */}
        <section>
          <h2 className="text-base md:text-lg font-bold text-gray-600 dark:text-gray-400 uppercase tracking-widest mb-4 md:mb-5">My Classes</h2>
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
            {HOME_TILES.map((tile) => {
               const badge = notifMap[tile.notifKey] || 0;
               return (
                 <Link key={tile.label} to={createPageUrl(tile.page)} className="relative min-h-[120px] md:min-h-[140px]">
                  <div className="h-full rounded-2xl p-4 md:p-5 text-white transition-transform hover:scale-105 active:scale-95 flex flex-col justify-between shadow-md hover:shadow-lg" style={{ backgroundColor: tile.color }}>
                    <div className="flex items-start justify-between">
                      <tile.icon className="h-7 w-7 md:h-8 md:w-8 opacity-90" />
                      {badge > 0 && (
                        <span className="bg-red-500 text-white text-xs md:text-sm font-bold rounded-full min-w-[22px] h-[22px] md:min-w-[24px] md:h-[24px] flex items-center justify-center px-0.5 shadow-md">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </div>
                    <p className="text-base md:text-lg font-bold leading-snug">{tile.label}</p>
                  </div>
                </Link>
               );
             })}
          </div>
        </section>

      </main>

      <StudentBottomNav currentPage="StudentDashboard" />
    </div>
  );
}