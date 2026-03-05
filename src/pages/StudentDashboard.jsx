import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home, LogOut, BookOpen, ClipboardList, Bell, Trophy,
  ChevronRight, Lock, Image, Calendar, Brain, FileText, Book,
  MessageSquare, TrendingUp, CheckCircle, AlertCircle, Clock,
  Ticket, BarChart3
} from 'lucide-react';
import StudentBottomNav from '@/components/StudentBottomNav';
import StudentSimpleNotificationListener from '@/components/StudentSimpleNotificationListener';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import StudentChangePassword from '@/components/StudentChangePassword';
import StudentMessageNotificationListener from '@/components/StudentMessageNotificationListener';
import StudentQuizNotificationListener from '@/components/StudentQuizNotificationListener';
import StudentNoticeNotificationListener from '@/components/StudentNoticeNotificationListener';

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

const HOME_TILES = [
  { label: 'Attendance', page: 'Attendance', icon: ClipboardList, color: '#26a69a', bg: '#e0f2f1', notifKey: null },
  { label: 'Marks', page: 'Marks', icon: BarChart3, color: '#1976d2', bg: '#e3f2fd', notifKey: null },
  { label: 'Diary', page: 'Diary', icon: Book, color: '#e91e63', bg: '#fce4ec', notifKey: 'Diary' },
  { label: 'Homework', page: 'StudentHomework', icon: BookOpen, color: '#f57c00', bg: '#fff3e0', notifKey: null },
  { label: 'Notices', page: 'Notices', icon: Bell, color: '#1a237e', bg: '#e8eaf6', notifKey: 'Notices' },
  { label: 'Hall Ticket', page: 'Results', icon: Ticket, color: '#388e3c', bg: '#e8f5e9', notifKey: 'HallTickets' },
  { label: 'Timetable', page: 'StudentTimetable', icon: Calendar, color: '#6a1b9a', bg: '#f3e5f5', notifKey: null },
  { label: 'Messages', page: 'StudentMessaging', icon: MessageSquare, color: '#0288d1', bg: '#e1f5fe', notifKey: 'Messages' },
];

export default function StudentDashboard() {
  const [student, setStudent] = useState(null);
  const [marks, setMarks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [notices, setNotices] = useState([]);
  const [homework, setHomework] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [todayClasses, setTodayClasses] = useState([]);
  const [attendancePct, setAttendancePct] = useState(0);
  const [currentYear, setCurrentYear] = useState(null);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) { window.location.href = createPageUrl('StudentLogin'); return; }
    setStudent(session);
    loadData(session);
  }, []);

  const loadData = async (session) => {
    setLoading(true);
    try {
      const [r, attendData, yearData, timetableData] = await Promise.all([
        base44.functions.invoke('getStudentData', {
          student_id: session.student_id,
          academic_year: session.academic_year,
          class_name: session.class_name
        }),
        base44.functions.invoke('calculateAttendanceSummaryForStudent', {
          student_id: session.student_id,
          academic_year: session.academic_year
        }).catch(() => null),
        base44.entities.AcademicYear.filter({ is_current: true }).then(d => d[0] || null).catch(() => null),
        base44.functions.invoke('studentGetTimetable', {
          student_id: session.student_id,
          academic_year: session.academic_year
        }).catch(() => ({ classes: [] }))
      ]);

      setMarks(r.data?.marks || []);
      setAttendance(r.data?.attendance || []);
      setNotices(r.data?.notices || []);
      setHomework(r.data?.homework || []);
      setSubmissions(r.data?.submissions || []);

      if (attendData?.data?.attendance_percentage) {
        setAttendancePct(Math.round(attendData.data.attendance_percentage));
      }

      if (yearData?.name) {
        setCurrentYear(yearData.name);
      }

      // Filter timetable for today
      if (timetableData?.classes && Array.isArray(timetableData.classes)) {
        const today = format(new Date(), 'EEEE');
        const todayFiltered = timetableData.classes.filter(c => c.day === today);
        setTodayClasses(todayFiltered.sort((a, b) => a.start_time.localeCompare(b.start_time)));
      }
    } catch {}
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('student_session');
    window.location.href = createPageUrl('StudentLogin');
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
      const counts = { Notices: 0, Diary: 0, Quiz: 0, Messages: 0, Results: 0, HallTickets: 0 };
       for (const n of notifs) {
         if (n.type === 'notice_posted') counts.Notices++;
         else if (n.type === 'diary_published') counts.Diary++;
         else if (n.type === 'quiz_posted') counts.Quiz++;
         else if (n.type === 'class_message') counts.Messages++;
         else if (n.type === 'marks_published' || n.type === 'results_posted') counts.Results++;
         else if (n.type === 'hall_ticket_published') counts.HallTickets++;
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
    return () => { unsub1(); unsub2(); };
  }, [student?.student_id]);

  const notifMap = {
    Diary: unreadCounts.Diary || 0,
    Quiz: unreadCounts.Quiz || 0,
    Notices: unreadCounts.Notices || 0,
    Results: unreadCounts.Results || 0,
    Messages: unreadCounts.Messages || 0,
    HallTickets: unreadCounts.HallTickets || 0,
  };

  const pendingHw = homework.filter(hw => !submissions.some(s => s.homework_id === hw.id)).length;

  if (!student) return null;

  const initials = student.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col max-w-md mx-auto relative">
      {/* Notification Listeners */}
      <StudentMessageNotificationListener studentSession={student} />
      <StudentQuizNotificationListener studentSession={student} />
      <StudentNoticeNotificationListener studentSession={student} />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 pt-4 pb-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-blue-200" />
            <span className="font-bold text-base">Student Portal</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-2.5 py-1 rounded-full transition-all"
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

      <main className="flex-1 overflow-y-auto pb-24 px-4 space-y-4">

        {/* Today's Classes */}
        {!loading && (
          <section className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="font-bold text-gray-800 text-sm mb-3">Today's Classes</h3>
            {todayClasses.length === 0 ? (
              <p className="text-xs text-gray-400">No classes scheduled today</p>
            ) : (
              <div className="space-y-2">
                {todayClasses.map((cls, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-xl">
                    <div className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1.5 rounded min-w-max">
                      {cls.start_time} - {cls.end_time}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{cls.subject}</p>
                      <p className="text-xs text-gray-500">{cls.teacher_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

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

      {showChangePassword && (
        <StudentChangePassword
          student={student}
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            setShowChangePassword(false);
            setStudent(getStudentSession());
          }}
        />
      )}
    </div>
  );
}