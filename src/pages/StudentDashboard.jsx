import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { GraduationCap, LogOut, BookOpen, ClipboardList, Bell, Trophy, User, ChevronRight, Lock, Image, Calendar, Brain, FileText, Book, MessageSquare } from 'lucide-react';
import StudentBottomNav from '@/components/StudentBottomNav';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import StudentChangePassword from '@/components/StudentChangePassword';



function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function StudentDashboard() {
  const [student, setStudent] = useState(null);
  const [marks, setMarks] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [notices, setNotices] = useState([]);
  const [homework, setHomework] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    const session = getStudentSession();
    if (!session) {
      window.location.href = createPageUrl('StudentLogin');
      return;
    }
    setStudent(session);
    loadData(session);
  }, []);

  const loadData = async (session) => {
    setLoading(true);
    try {
      const [marksData, attendanceData, noticesData, homeworkData, submissionsData] = await Promise.all([
        base44.functions.invoke('getStudentData', { student_id: session.student_id, academic_year: session.academic_year, class_name: session.class_name }).then(r => ({
          marks: r.data?.marks || [],
          attendance: r.data?.attendance || [],
          notices: r.data?.notices || [],
          homework: r.data?.homework || [],
          submissions: r.data?.submissions || []
        }))
      ]);
      setMarks(marksData.marks);
      setAttendance(marksData.attendance);
      setNotices(marksData.notices);
      setHomework(marksData.homework);
      setSubmissions(marksData.submissions);
    } catch (e) {}
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('student_session');
    window.location.href = createPageUrl('StudentLogin');
  };

  const { data: unreadDiaryCount = 0 } = useQuery({
    queryKey: ['unread-diary-count', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return 0;
      try {
        const notifications = await base44.entities.Notification.filter({
          recipient_student_id: student.student_id,
          type: 'diary_published',
          is_read: false
        });
        return notifications.length;
      } catch {
        return 0;
      }
    },
    enabled: !!student?.student_id,
    refetchInterval: 2000
  });

  const { data: unreadQuizCount = 0 } = useQuery({
    queryKey: ['unread-quiz-count', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return 0;
      try {
        const notifications = await base44.entities.Notification.filter({
          recipient_student_id: student.student_id,
          type: 'quiz_posted',
          is_read: false
        });
        return notifications.length;
      } catch {
        return 0;
      }
    },
    enabled: !!student?.student_id,
    refetchInterval: 2000
  });

  const { data: unreadNoticeCount = 0 } = useQuery({
    queryKey: ['unread-notice-count', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return 0;
      try {
        const notifications = await base44.entities.Notification.filter({
          recipient_student_id: student.student_id,
          type: 'notice_posted',
          is_read: false
        });
        return notifications.length;
      } catch {
        return 0;
      }
    },
    enabled: !!student?.student_id,
    refetchInterval: 2000
  });

  const { data: unreadResultsCount = 0 } = useQuery({
    queryKey: ['unread-results-count', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return 0;
      try {
        const notifications = await base44.entities.Notification.filter({
          recipient_student_id: student.student_id,
          type: 'results_posted',
          is_read: false
        });
        return notifications.length;
      } catch {
        return 0;
      }
    },
    enabled: !!student?.student_id,
    refetchInterval: 2000
  });

  const { data: unreadMessageCount = 0 } = useQuery({
    queryKey: ['unread-message-count', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return 0;
      try {
        const messages = await base44.entities.Message.filter({
          recipient_id: student.student_id,
          is_read: false
        });
        return messages.length;
      } catch {
        return 0;
      }
    },
    enabled: !!student?.student_id,
    refetchInterval: 15000
  });

  if (!student) return null;

  const studentQuickAccess = [
    { label: 'Results', page: 'Results', icon: Trophy, bg: '#e8f5e9', color: '#388e3c' },
    { label: 'Notices', page: 'Notices', icon: Bell, bg: '#e3f2fd', color: '#1565c0' },
    { label: 'Gallery', page: 'Gallery', icon: Image, bg: '#fce4ec', color: '#c62828' },
    { label: 'Calendar', page: 'Calendar', icon: Calendar, bg: '#fff3e0', color: '#e65100' },
    { label: 'Quiz', page: 'Quiz', icon: Brain, bg: '#f3e5f5', color: '#6a1b9a' },
    { label: 'Diary', page: 'Diary', icon: Book, bg: '#fce4ec', color: '#c2185b' },
    { label: 'Messages', page: 'StudentMessaging', icon: MessageSquare, bg: '#e8eaf6', color: '#1a237e' },
  ];

  const presentCount = attendance.filter(a => a.is_present).length;
  const attendancePct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

  const subjectMap = {};
  marks.forEach(m => {
    if (!subjectMap[m.subject]) subjectMap[m.subject] = [];
    subjectMap[m.subject].push(m);
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-md mx-auto relative" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Header */}
      <header className="bg-[#1a237e] text-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-7 w-7" />
          <span className="font-bold text-lg">Student Portal</span>
        </div>
        <button onClick={handleLogout} className="flex items-center gap-1 text-blue-200 hover:text-white text-sm">
          <LogOut className="h-5 w-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20 p-4 space-y-4">

        {/* Quick Access */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3">Quick Access</h2>
          <div className="grid grid-cols-3 gap-3">
            {studentQuickAccess.map((item) => {
              let badgeCount = 0;
              if (item.label === 'Diary') badgeCount = unreadDiaryCount;
              else if (item.label === 'Quiz') badgeCount = unreadQuizCount;
              else if (item.label === 'Notices') badgeCount = unreadNoticeCount;
              else if (item.label === 'Results') badgeCount = unreadResultsCount;
              else if (item.label === 'Messages') badgeCount = unreadMessageCount;

              return (
                <Link key={item.label} to={createPageUrl(item.page)} className="block">
                  <div className="bg-white rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm relative h-full">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.bg }}>
                      <item.icon className="h-6 w-6" style={{ color: item.color }} />
                    </div>
                    {badgeCount > 0 && (
                      <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                        {badgeCount}
                      </span>
                    )}
                    <span className="text-xs font-medium text-gray-700 text-center leading-tight">{item.label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Profile Card */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16 border-2 border-white">
                <AvatarImage src={student.photo_url} />
                <AvatarFallback className="bg-blue-300 text-white text-xl font-bold">
                  {student.name?.[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-white">
                <h2 className="font-bold text-lg">{student.name}</h2>
                <p className="text-blue-200 text-sm">Class {student.class_name}-{student.section} | Roll #{student.roll_no}</p>
                <p className="text-blue-300 text-xs mt-0.5">{student.username} • {student.academic_year}</p>
              </div>
            </div>
          </div>
          <CardContent className="p-3 flex gap-3">
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex-1 flex items-center justify-center gap-2 text-sm text-[#1a237e] font-medium py-2 rounded-lg border border-[#1a237e] hover:bg-blue-50 transition-colors"
            >
              <Lock className="h-4 w-4" /> Change Password
            </button>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm text-center">
            <CardContent className="p-3">
              <p className="text-2xl font-bold text-[#1a237e]">{attendancePct}%</p>
              <p className="text-xs text-gray-500 mt-0.5">Attendance</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm text-center">
            <CardContent className="p-3">
              <p className="text-2xl font-bold text-green-600">{marks.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Results</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm text-center">
            <CardContent className="p-3">
              <p className="text-2xl font-bold text-amber-500">{notices.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Notices</p>
            </CardContent>
          </Card>
        </div>

        {/* Homework / Assignments */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-orange-500" /> Homework & Assignments
            </h3>
            {loading ? (
              <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
            ) : homework.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">No homework assigned yet.</div>
            ) : (
              <div className="space-y-2">
                {homework.map((hw) => {
                  const isSubmitted = submissions.some(s => s.homework_id === hw.id);
                  const isOverdue = hw.due_date && new Date(hw.due_date) < new Date();
                  return (
                    <div key={hw.id} className="p-3 bg-orange-50 rounded-xl border border-orange-100">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm">{hw.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{hw.subject} {hw.assigned_by ? `• ${hw.assigned_by}` : ''}</p>
                          {hw.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{hw.description}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 flex-shrink-0">
                          {isSubmitted ? (
                            <Badge className="text-[10px] bg-blue-100 text-blue-700 border-0">Submitted</Badge>
                          ) : (
                            <Badge className={`text-[10px] ${isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'} border-0`}>
                              {isOverdue ? 'Overdue' : 'Pending'}
                            </Badge>
                          )}
                          {hw.due_date && (
                            <span className="text-[10px] text-slate-500">Due: {format(new Date(hw.due_date), 'dd MMM')}</span>
                          )}
                        </div>
                      </div>
                      {hw.attachment_url && (
                        <a href={hw.attachment_url} target="_blank" rel="noopener noreferrer"
                          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:underline">
                          <FileText className="h-3 w-3" /> View Attachment
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Summary */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#1a237e]" /> Attendance (Last 30 Days)
            </h3>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1 bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full ${attendancePct >= 75 ? 'bg-green-500' : 'bg-red-500'}`}
                  style={{ width: `${attendancePct}%` }}
                />
              </div>
              <span className={`text-sm font-bold ${attendancePct >= 75 ? 'text-green-600' : 'text-red-600'}`}>{attendancePct}%</span>
            </div>
            <div className="flex gap-4 text-sm text-gray-500">
              <span>Present: <strong className="text-green-600">{presentCount}</strong></span>
              <span>Absent: <strong className="text-red-600">{attendance.length - presentCount}</strong></span>
              <span>Total: <strong>{attendance.length}</strong></span>
            </div>
            {attendancePct < 75 && (
              <div className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                ⚠️ Attendance below 75%. Please regularise.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Marks */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" /> My Results
            </h3>
            {loading ? (
              <div className="text-center py-4 text-gray-400 text-sm">Loading...</div>
            ) : marks.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">No published results yet.</div>
            ) : (
              <div className="space-y-2">
                {marks.slice(0, 10).map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-medium text-slate-800 text-sm">{m.subject}</p>
                      <p className="text-xs text-slate-500">{m.exam_type}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#1a237e]">{m.marks_obtained}/{m.max_marks}</p>
                      {m.grade && <Badge className="text-xs bg-green-100 text-green-700 border-0">{m.grade}</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notices */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-500" /> Latest Notices
            </h3>
            {notices.length === 0 ? (
              <div className="text-center py-4 text-gray-400 text-sm">No notices.</div>
            ) : (
              <div className="space-y-2">
                {notices.slice(0, 5).map((n) => (
                  <div key={n.id} className="p-3 bg-slate-50 rounded-xl">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-800 text-sm">{n.title}</p>
                      <Badge className="text-xs shrink-0 bg-blue-100 text-blue-700 border-0">{n.notice_type}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{n.content}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <StudentBottomNav currentPage="StudentDashboard" />

      {showChangePassword && (
        <StudentChangePassword
          student={student}
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            setShowChangePassword(false);
            const session = getStudentSession();
            setStudent(session);
          }}
        />
      )}
    </div>
  );
}