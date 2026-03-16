import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Home, LogOut, BookOpen, ClipboardList, Bell, Trophy,
  ChevronRight, Lock, Image, Calendar, Brain, FileText, Book,
  MessageSquare, TrendingUp, CheckCircle, AlertCircle, Clock,
  Ticket, BarChart3
} from 'lucide-react';
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
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStudentSession();
    if (!session) { window.location.href = createPageUrl('StudentLogin'); return; }
    setStudent(session);
    autoRegisterPush(session);
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

      // Convert VAPID key
      const padding = '='.repeat((4 - vapidKey.length % 4) % 4);
      const base64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const applicationServerKey = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) applicationServerKey[i] = rawData.charCodeAt(i);

      // Subscribe
      let subscription = await reg.pushManager.getSubscription();
      if (!subscription) {
        subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
      }

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
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col relative">
      {/* Unified Notification Hub */}
      <StudentNotificationHub studentSession={student} />
      
      {/* Push Notification Manager */}
      <PushNotificationManager studentId={student?.student_id} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-2.5 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {schoolProfile?.logo_url ? (
              <img
                src={schoolProfile.logo_url}
                alt="School Logo"
                className="h-9 w-9 object-contain rounded-full bg-white p-0.5 flex-shrink-0 shadow"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                <Home className="h-5 w-5 text-white" />
              </div>
            )}
            <div className="leading-tight">
              <p className="font-bold text-sm leading-none">{schoolProfile?.school_name || 'BVM School'}</p>
              <p className="text-blue-200 text-[10px] mt-0.5">Student Portal</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1.5 rounded-full transition-all"
          >
            <LogOut className="h-3 w-3" /> Logout
          </button>
        </div>
      </header>

      {/* Header Card */}
      <div className="px-4 pt-4 pb-2">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{student?.name}</h2>
              <p className="text-xs text-gray-500 mt-1">Class {student?.class_name}-{student?.section} | ID: {student?.student_id}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">
              <strong>{currentYear || 'Academic year not set'}</strong>
            </span>
            <span className={`font-bold text-base ${attendancePct >= 75 ? 'text-emerald-600' : 'text-red-500'}`}>
              {attendancePct}%
            </span>
          </div>
          <div className="mt-2 bg-gray-100 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${attendancePct >= 75 ? 'bg-emerald-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(attendancePct, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-2">Attendance</p>
        </div>
      </div>

      <main
        className="flex-1 overflow-y-auto pb-24 px-4 space-y-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull-to-refresh indicator */}
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullY > 0 ? pullY : (isRefreshing ? 48 : 0) }}
        >
          <div className={`flex items-center gap-2 text-indigo-600 text-sm font-medium ${isRefreshing ? 'animate-pulse' : ''}`}>
            <div className={`w-5 h-5 border-2 border-indigo-400 border-t-indigo-700 rounded-full ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : pullY >= 60 ? 'Release to refresh' : 'Pull to refresh'}
          </div>
        </div>



        {/* Home Tiles (2-column) */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">My Classes</h2>
          <div className="grid grid-cols-2 gap-3">
            {HOME_TILES.map((tile) => {
               const badge = notifMap[tile.notifKey] || 0;
               return (
                 <Link key={tile.label} to={createPageUrl(tile.page)} className="relative">
                  <div className="rounded-2xl p-4 text-white transition-transform hover:scale-105" style={{ backgroundColor: tile.color }}>
                    <div className="flex items-start justify-between mb-2">
                      <tile.icon className="h-5 w-5 opacity-90" />
                      {badge > 0 && (
                        <span className="bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{tile.label}</p>
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