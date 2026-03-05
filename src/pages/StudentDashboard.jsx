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
  { label: 'Hall Ticket', page: 'Results', icon: Ticket, color: '#388e3c', bg: '#e8f5e9', notifKey: null },
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
      const counts = { Notices: 0, Diary: 0, Quiz: 0, Messages: 0, Results: 0 };
      for (const n of notifs) {
        if (n.type === 'notice_posted') counts.Notices++;
        else if (n.type === 'diary_published') counts.Diary++;
        else if (n.type === 'quiz_posted') counts.Quiz++;
        else if (n.type === 'class_message') counts.Messages++;
        else if (n.type === 'marks_published' || n.type === 'results_posted') counts.Results++;
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
      <header className="sticky top-0 z-50">
        <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] px-4 pt-4 pb-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-blue-200" />
              <span className="font-bold text-white text-base tracking-wide">Student Portal</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-full transition-all"
            >
              <LogOut className="h-3.5 w-3.5" /> Logout
            </button>
          </div>
          {/* Profile inline */}
          <Link to={createPageUrl('UserProfile')} className="flex items-center gap-3 group">
            <div className="relative">
              <Avatar className="h-14 w-14 border-2 border-white/50 shadow-md">
                <AvatarImage src={student.photo_url} />
                <AvatarFallback className="bg-indigo-300 text-white font-bold text-lg">{initials}</AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1">
              <h2 className="text-white font-bold text-lg leading-tight">{student.name}</h2>
              <p className="text-blue-200 text-xs">Class {student.class_name}-{student.section} · Roll #{student.roll_no}</p>
              <p className="text-blue-300 text-xs">{student.academic_year}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-white/50 flex-shrink-0" />
          </Link>
        </div>
      </header>

      {/* Stats floating cards */}
      <div className="px-4 mt-4 mb-4 z-10 relative">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Attendance', value: `${attendancePct}%`, icon: ClipboardList, color: attendancePct >= 75 ? 'text-emerald-600' : 'text-red-500', bg: attendancePct >= 75 ? 'bg-emerald-50' : 'bg-red-50' },
            { label: 'Results',    value: marks.length,        icon: Trophy,         color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Pending HW', value: pendingHw,           icon: BookOpen,       color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl shadow-sm p-3 flex flex-col items-center gap-1">
              <div className={`${s.bg} rounded-xl p-1.5`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <span className={`text-xl font-bold ${s.color}`}>{s.value}</span>
              <span className="text-[10px] text-gray-400 font-medium text-center">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto pb-24 px-4 space-y-5">

        {/* Quick Access */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Access</h2>
          <div className="grid grid-cols-4 gap-3">
            {QUICK_ACCESS.map((item) => {
              const badge = item.notifKey ? (notifMap[item.notifKey] || 0) : 0;
              return (
                <Link key={item.label} to={createPageUrl(item.page)} className="block">
                  <div className="flex flex-col items-center gap-1.5 relative">
                    <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.gradient} flex items-center justify-center shadow-md`}>
                      <item.icon className="h-6 w-6 text-white" />
                    </div>
                    {badge > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                        {badge > 9 ? '9+' : badge}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Attendance */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-indigo-500" /> Attendance
            </h3>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${attendancePct >= 75 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {attendancePct}%
            </span>
          </div>
          <div className="bg-gray-100 rounded-full h-2.5 mb-3">
            <div
              className={`h-2.5 rounded-full transition-all ${attendancePct >= 75 ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-red-400 to-red-500'}`}
              style={{ width: `${attendancePct}%` }}
            />
          </div>
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><CheckCircle className="h-3.5 w-3.5 text-emerald-500" /> Present: <b className="text-emerald-600">{presentCount}</b></span>
            <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5 text-red-400" /> Absent: <b className="text-red-500">{attendance.length - presentCount}</b></span>
          </div>
          {attendancePct < 75 && (
            <div className="mt-3 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 flex items-center gap-1.5">
              ⚠️ Attendance below 75%. Please regularise attendance.
            </div>
          )}
        </section>

        {/* Homework */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-orange-500" /> Homework
            </h3>
            <Link to={createPageUrl('StudentHomework')} className="text-xs text-indigo-600 font-semibold flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : homework.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">No homework assigned yet 🎉</div>
          ) : (
            <div className="space-y-2">
              {homework.slice(0, 4).map((hw) => {
                const isSubmitted = submissions.some(s => s.homework_id === hw.id);
                const isOverdue = hw.due_date && new Date(hw.due_date) < new Date();
                return (
                  <div key={hw.id} className={`p-3 rounded-xl border-l-4 ${isSubmitted ? 'bg-green-50 border-green-400' : isOverdue ? 'bg-red-50 border-red-400' : 'bg-orange-50 border-orange-400'}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm truncate">{hw.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{hw.subject}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isSubmitted ? 'bg-green-200 text-green-700' : isOverdue ? 'bg-red-200 text-red-700' : 'bg-orange-200 text-orange-700'}`}>
                          {isSubmitted ? '✓ Done' : isOverdue ? 'Overdue' : 'Pending'}
                        </span>
                        {hw.due_date && (
                          <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {format(new Date(hw.due_date), 'dd MMM')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Results */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" /> My Results
            </h3>
            <Link to={createPageUrl('Results')} className="text-xs text-indigo-600 font-semibold flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : marks.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">No published results yet.</div>
          ) : (
            <div className="space-y-2">
              {marks.slice(0, 5).map((m) => {
                const pct = m.max_marks > 0 ? Math.round((m.marks_obtained / m.max_marks) * 100) : 0;
                return (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm truncate">{m.subject}</p>
                      <p className="text-xs text-gray-400">{m.exam_type}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-indigo-700 text-sm">{m.marks_obtained}/{m.max_marks}</p>
                      {m.grade && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${pct >= 75 ? 'bg-green-100 text-green-700' : pct >= 50 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>{m.grade}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Notices */}
        <section className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800 flex items-center gap-2">
              <Bell className="h-4 w-4 text-blue-500" /> Latest Notices
            </h3>
            <Link to={createPageUrl('Notices')} className="text-xs text-indigo-600 font-semibold flex items-center gap-0.5">
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {notices.length === 0 ? (
            <div className="text-center py-6 text-gray-400 text-sm">No notices available.</div>
          ) : (
            <div className="space-y-2">
              {notices.slice(0, 4).map((n) => (
                <div key={n.id} className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-gray-800 text-sm leading-snug">{n.title}</p>
                    <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full shrink-0">{n.notice_type}</span>
                  </div>
                  {n.content && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.content}</p>}
                </div>
              ))}
            </div>
          )}
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