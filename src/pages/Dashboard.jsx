import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useApprovalsCount } from '@/components/ApprovalsCountBadge';
import {
  ClipboardCheck, CheckSquare, BookOpen, BookMarked, Bell, Image, NotebookPen,
  ListChecks, Calendar, MessageSquare, AlertCircle, Wallet, BarChart3,
  TrendingUp, Receipt, Users, Settings, FileText, DollarSign, BookUser,
} from 'lucide-react';

// Read staff session from localStorage — this is the source of truth for role
function getStaffSession() {
  try {
    const raw = localStorage.getItem('staff_session');
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
}

// Normalise role string
function normaliseRole(r) {
  return (r || '').trim().toLowerCase();
}

export default function Dashboard() {
  const { academicYear } = useAcademicYear();
  const [staffRole, setStaffRole] = useState('');
  const [staffName, setStaffName] = useState('');
  const [roleSource, setRoleSource] = useState('');
  const [permissionsCount, setPermissionsCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [latestDiaries, setLatestDiaries] = useState([]);
  const [recentNotices, setRecentNotices] = useState([]);

  const isAdmin = staffRole === 'admin' || staffRole === 'principal';
  const isTeacher = staffRole === 'teacher';
  const isAccountant = staffRole === 'accountant';
  const isExamStaff = staffRole === 'exam_staff';

  const approvalsCount = useApprovalsCount(academicYear, isAdmin);

  useEffect(() => {
    loadDashboard();
  }, [academicYear]);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      const session = getStaffSession();
      let resolvedRole = '';

      if (session) {
        // Always re-verify role from StaffAccount via signed session token
        const token = session.staff_session_token;
        if (token) {
          try {
            const res = await base44.functions.invoke('getMyStaffProfile', {
              staff_session_token: token,
            });
            if (res.data?.role) {
              resolvedRole = normaliseRole(res.data.role);
              setStaffRole(resolvedRole);
              setStaffName(res.data.name || session.name || '');
              setPermissionsCount(Object.values(res.data.permissions || {}).filter(Boolean).length);
              setRoleSource('staff_session_token (verified)');

              // Patch stale session role if needed
              if (normaliseRole(session.role) !== resolvedRole) {
                const updated = { ...session, role: resolvedRole };
                localStorage.setItem('staff_session', JSON.stringify(updated));
              }
            } else {
              // Server returned error — fall back to session
              resolvedRole = normaliseRole(session.role);
              setStaffRole(resolvedRole);
              setStaffName(session.name || '');
              setPermissionsCount(0);
              setRoleSource('staff_session (localStorage fallback)');
            }
          } catch {
            // Network error — use session as fallback
            resolvedRole = normaliseRole(session.role);
            setStaffRole(resolvedRole);
            setStaffName(session.name || '');
            setPermissionsCount(0);
            setRoleSource('staff_session (fallback — server unreachable)');
          }
        } else {
          // No token in session — use session data directly
          resolvedRole = normaliseRole(session.role);
          setStaffRole(resolvedRole);
          setStaffName(session.name || '');
          setPermissionsCount(0);
          setRoleSource('staff_session (no token — localStorage only)');
        }
      } else {
        // No staff session — try base44.auth.me() (for admin users who log in via platform)
        const currentUser = await base44.auth.me().catch(() => null);
        if (currentUser) {
          resolvedRole = normaliseRole(currentUser.role);
          setStaffRole(resolvedRole);
          setStaffName(currentUser.full_name || currentUser.email || '');
          setRoleSource('platform auth.me()');
        }
      }

      // Load content for non-accountant roles
      if (resolvedRole !== 'accountant') {
        try {
          const diaries = await base44.entities.Diary.list('-created_date', 3);
          setLatestDiaries(diaries || []);
        } catch {}
        try {
          const notices = await base44.entities.Notice.list('-publish_date', 5);
          setRecentNotices(notices || []);
        } catch {}
      }
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const GradientIcon = ({ gradient, icon: Icon }) => (
    <div className={`bg-gradient-to-br ${gradient} p-3 rounded-2xl text-white`}>
      <Icon className="h-6 w-6" />
    </div>
  );

  const ActionCard = ({ label, icon, page, gradient }) => (
    <Link to={createPageUrl(page)} className="block">
      <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
        <GradientIcon gradient={gradient} icon={icon} />
        <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">{label}</span>
      </div>
    </Link>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── ACCOUNTANT DASHBOARD ───────────────────────────────────────────────────
  if (isAccountant) {
    const feeActions = [
      { label: 'Fee Collection',    icon: Wallet,      page: 'Fees',                  gradient: 'from-green-500 to-emerald-600' },
      { label: 'Collection Report', icon: BarChart3,    page: 'CollectionReport',       gradient: 'from-blue-500 to-blue-700' },
      { label: 'Outstanding Dues',  icon: TrendingUp,   page: 'OutstandingReport',      gradient: 'from-red-500 to-rose-600' },
      { label: 'Ledger',            icon: BookOpen,     page: 'StudentLedgerReport',    gradient: 'from-indigo-500 to-indigo-700' },
      { label: 'Day Book',          icon: FileText,     page: 'DayBookReport',          gradient: 'from-violet-500 to-purple-600' },
      { label: 'Daily Closing',     icon: Receipt,      page: 'DailyClosingReport',     gradient: 'from-teal-500 to-cyan-600' },
      { label: 'Defaulters',        icon: AlertCircle,  page: 'DefaultersReport',       gradient: 'from-orange-500 to-amber-600' },
      { label: 'Parent Statement',  icon: DollarSign,   page: 'ParentStatement',        gradient: 'from-pink-500 to-rose-500' },
    ];

    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {staffName || 'Accountant'}</h1>
            <p className="text-gray-500 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>

          {/* Debug bar */}
          <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-mono">
            roleSource: {roleSource} | staffRole: {staffRole} | permissions: {permissionsCount}
          </div>

          <section>
            <h2 className="text-lg font-bold text-gray-700 mb-4">Fees &amp; Accounts</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {feeActions.map(a => <ActionCard key={a.label} {...a} />)}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ─── TEACHER DASHBOARD ──────────────────────────────────────────────────────
  if (isTeacher) {
    const teacherActions = [
      { label: 'Attendance',  icon: CheckSquare,   page: 'Attendance',          gradient: 'from-blue-400 to-blue-600' },
      { label: 'Marks Entry', icon: BookOpen,       page: 'Marks',               gradient: 'from-green-400 to-green-600' },
      { label: 'Homework',    icon: BookMarked,     page: 'Homework',            gradient: 'from-purple-400 to-purple-600' },
      { label: 'Diary',        icon: NotebookPen,    page: 'Diary',               gradient: 'from-pink-400 to-pink-600' },
      { label: 'Notices',     icon: Bell,           page: 'Notices',             gradient: 'from-yellow-400 to-yellow-600' },
      { label: 'Quiz',        icon: ListChecks,     page: 'Quiz',                gradient: 'from-indigo-400 to-indigo-600' },
      { label: 'Gallery',     icon: Image,          page: 'Gallery',             gradient: 'from-orange-400 to-orange-600' },
      { label: 'Messages',    icon: MessageSquare,  page: 'Messaging',           gradient: 'from-teal-400 to-teal-600' },
      { label: 'Timetable',   icon: Calendar,       page: 'TimetableManagement', gradient: 'from-cyan-400 to-cyan-600' },
    ];

    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {staffName || 'Teacher'}</h1>
            <p className="text-gray-500 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>

          {/* Debug bar */}
          <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-mono">
            roleSource: {roleSource} | staffRole: {staffRole} | permissions: {permissionsCount}
          </div>

          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-700 mb-4">Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {teacherActions.map(a => <ActionCard key={a.label} {...a} />)}
            </div>
          </section>

          {recentNotices.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-700 mb-4">Recent Notices</h2>
              <div className="space-y-3">
                {recentNotices.slice(0, 3).map(notice => (
                  <div key={notice.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-yellow-500">
                    <p className="font-semibold text-gray-900">{notice.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{notice.notice_type}</p>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{notice.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ─── EXAM STAFF DASHBOARD ───────────────────────────────────────────────────
  if (isExamStaff) {
    const examActions = [
      { label: 'Marks Entry',  icon: BookOpen,    page: 'Marks',               gradient: 'from-green-400 to-green-600' },
      { label: 'Attendance',   icon: CheckSquare, page: 'Attendance',          gradient: 'from-blue-400 to-blue-600' },
      { label: 'Exams',        icon: BookMarked,  page: 'ExamManagement',      gradient: 'from-purple-400 to-purple-600' },
      { label: 'Att. Report',  icon: BarChart3,   page: 'AttendanceReport',    gradient: 'from-teal-400 to-teal-600' },
    ];

    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {staffName || 'Exam Staff'}</h1>
            <p className="text-gray-500 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>
          <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-mono">
            roleSource: {roleSource} | staffRole: {staffRole} | permissions: {permissionsCount}
          </div>
          <section>
            <h2 className="text-lg font-bold text-gray-700 mb-4">Exam &amp; Attendance</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {examActions.map(a => <ActionCard key={a.label} {...a} />)}
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ─── ADMIN / PRINCIPAL DASHBOARD ────────────────────────────────────────────
  if (isAdmin) {
    const adminSections = [
      {
        title: 'Academics',
        actions: [
          { label: 'Students',     icon: Users,          page: 'Students',            gradient: 'from-blue-400 to-blue-600' },
          { label: 'Attendance',   icon: CheckSquare,    page: 'Attendance',          gradient: 'from-teal-400 to-teal-600' },
          { label: 'Marks',        icon: BookOpen,       page: 'Marks',               gradient: 'from-green-400 to-green-600' },
          { label: 'Exams',        icon: BookMarked,     page: 'ExamManagement',      gradient: 'from-purple-400 to-purple-600' },
          { label: 'Timetable',    icon: Calendar,       page: 'TimetableManagement', gradient: 'from-cyan-400 to-cyan-600' },
          { label: 'Homework',     icon: BookMarked,     page: 'Homework',            gradient: 'from-pink-400 to-pink-600' },
          { label: 'Diary',        icon: NotebookPen,    page: 'Diary',               gradient: 'from-rose-400 to-rose-600' },
          { label: 'Admissions',   icon: FileText,       page: 'Admissions',          gradient: 'from-amber-400 to-amber-600' },
        ],
      },
      {
        title: 'Communication',
        actions: [
          { label: 'Notices',      icon: Bell,           page: 'Notices',             gradient: 'from-yellow-400 to-yellow-600' },
          { label: 'Gallery',      icon: Image,          page: 'Gallery',             gradient: 'from-orange-400 to-orange-600' },
          { label: 'Quiz',         icon: ListChecks,     page: 'Quiz',                gradient: 'from-indigo-400 to-indigo-600' },
          { label: 'Messages',     icon: MessageSquare,  page: 'Messaging',           gradient: 'from-sky-400 to-sky-600' },
        ],
      },
      {
        title: 'Fees & Finance',
        actions: [
          { label: 'Fee Collection', icon: Wallet,       page: 'Fees',                gradient: 'from-emerald-400 to-emerald-600' },
          { label: 'Collection Rpt', icon: BarChart3,    page: 'CollectionReport',    gradient: 'from-blue-400 to-blue-600' },
          { label: 'Outstanding',    icon: TrendingUp,   page: 'OutstandingReport',   gradient: 'from-red-400 to-red-600' },
          { label: 'Ledger',         icon: BookOpen,     page: 'StudentLedgerReport', gradient: 'from-violet-400 to-violet-600' },
          { label: 'Day Book',       icon: FileText,     page: 'DayBookReport',       gradient: 'from-slate-400 to-slate-600' },
          { label: 'Defaulters',     icon: AlertCircle,  page: 'DefaultersReport',    gradient: 'from-orange-400 to-orange-600' },
        ],
      },
      {
        title: 'Reports & Analytics',
        actions: [
          { label: 'Reports',        icon: BarChart3,    page: 'Reports',             gradient: 'from-purple-400 to-purple-600' },
          { label: 'Att. Report',    icon: ClipboardCheck, page: 'AttendanceReport',  gradient: 'from-teal-400 to-teal-600' },
        ],
      },
      {
        title: 'Administration',
        actions: [
          { label: 'Staff',          icon: BookUser,     page: 'Staff',               gradient: 'from-amber-400 to-amber-600' },
          { label: 'Settings',       icon: Settings,     page: 'Settings',            gradient: 'from-gray-400 to-gray-600' },
        ],
      },
    ];

    return (
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Welcome, {staffName || staffRole}</h1>
            <p className="text-gray-500 text-sm mt-1">{academicYear && `Academic Year: ${academicYear}`}</p>
          </div>

          {/* Debug bar */}
          <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-mono">
            roleSource: {roleSource} | staffRole: {staffRole} | permissions: {permissionsCount}
          </div>

          {approvalsCount > 0 && (
            <section className="mb-6">
              <Link to={createPageUrl('Approvals')}>
                <div className="bg-red-50 rounded-2xl p-4 shadow-sm border border-red-200 hover:shadow-md transition-shadow flex items-center gap-3">
                  <div className="bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold flex-shrink-0">
                    {approvalsCount > 9 ? '9+' : approvalsCount}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Pending Approvals</p>
                    <p className="text-sm text-gray-600">Review and approve pending submissions</p>
                  </div>
                  <ClipboardCheck className="h-5 w-5 text-red-400 ml-auto" />
                </div>
              </Link>
            </section>
          )}

          {adminSections.map(section => (
            <section key={section.title} className="mb-8">
              <h2 className="text-lg font-bold text-gray-700 mb-4">{section.title}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {section.actions.map(a => <ActionCard key={a.label} {...a} />)}
              </div>
            </section>
          ))}

          {latestDiaries.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-gray-700 mb-4">Latest Diary Entries</h2>
              <div className="space-y-3">
                {latestDiaries.map(diary => (
                  <div key={diary.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-pink-500">
                    <p className="font-semibold text-gray-900">{diary.title}</p>
                    <p className="text-xs text-gray-500 mt-1">Class {diary.class_name} • {diary.subject}</p>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{diary.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    );
  }

  // ─── UNKNOWN / GENERIC ROLE ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Welcome, {staffName || 'Staff'}</h1>
        </div>
        <div className="mb-4 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 font-mono">
          roleSource: {roleSource} | staffRole: &quot;{staffRole}&quot; | permissions: {permissionsCount}
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-amber-500 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-gray-900">Role not recognised: &quot;{staffRole || 'unknown'}&quot;</p>
            <p className="text-sm text-gray-600 mt-1">Contact your administrator to ensure your role is correctly assigned in StaffAccount.</p>
          </div>
        </div>
      </div>
    </div>
  );
}