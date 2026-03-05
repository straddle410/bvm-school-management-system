import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getStaffSession, clearStaffSession } from '@/components/useStaffSession';
import StudentExamSectionWithBadges from '@/components/exam/StudentExamSectionWithBadges';
import TeacherExamCard from '@/components/exam/TeacherExamCard';
import {
  Megaphone, ClipboardList, LayoutDashboard, Users, UserPlus, BookOpen,
  ClipboardCheck, Settings, ChevronRight, LogOut, GraduationCap,
  Phone, Globe, Shield, HelpCircle, Info, LogIn, MessageSquare,
  Ticket, Calendar, TrendingUp, FileText, Award, BarChart3, AlertCircle, Image, User as UserIcon
} from 'lucide-react';

export default function More() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [studentSession, setStudentSession] = useState(null);

  useEffect(() => {
    base44.entities.SchoolProfile.list().then(p => p.length && setSchoolProfile(p[0])).catch(() => {});
    const session = getStaffSession();
    if (session) {
      setUser(session);
      setLoading(false);
    } else {
      try {
        const studentSess = JSON.parse(localStorage.getItem('student_session'));
        if (studentSess) {
          setStudentSession(studentSess);
          setLoading(false);
          return;
        }
      } catch {}
      base44.auth.me().then(u => {
        setUser(u);
        setLoading(false);
      }).catch(() => setLoading(false));
    }
  }, []);

  const role = (user?.role || '').toLowerCase();
  const isAdmin = ['admin', 'principal'].includes(role);
  const isTeacher = ['admin', 'principal', 'teacher', 'staff'].includes(role);
  const permissions = user?.permissions || {};
  const canViewFinance = isAdmin || !!permissions.fees_view_module || !!permissions.fee_reports_view || !!permissions.fees_view_ledger;

  const examItems = {
    admin: [
      { label: 'Exam Types', sub: 'Create & manage exams', icon: ClipboardList, color: '#d32f2f', bg: '#ffebee', page: 'ExamManagement', tab: 'exam-types' },
      { label: 'Timetable', sub: 'Set exam schedule', icon: Calendar, color: '#1976d2', bg: '#e3f2fd', page: 'ExamManagement', tab: 'timetable' },
      { label: 'Hall Tickets', sub: 'Generate hall tickets', icon: Ticket, color: '#388e3c', bg: '#e8f5e9', page: 'HallTicketManagement' },
      { label: 'Marks Entry', sub: 'Enter student marks', icon: FileText, color: '#7b1fa2', bg: '#f3e5f5', page: 'Marks' },
      { label: 'Results Publish', sub: 'Publish exam results', icon: TrendingUp, color: '#f57c00', bg: '#fff3e0', page: 'ExamManagement', tab: 'results' },
      { label: 'Progress Cards', sub: 'Generate progress reports', icon: Award, color: '#1976d2', bg: '#e3f2fd', page: 'ExamManagement', tab: 'progress-cards' },
    ],
    teacher: [
      { label: 'Marks Entry', sub: 'Enter student marks', icon: FileText, color: '#7b1fa2', bg: '#f3e5f5', page: 'Marks' },
      { label: 'Results', sub: 'View & submit results', icon: TrendingUp, color: '#f57c00', bg: '#fff3e0', page: 'ExamManagement', tab: 'results' },
    ],
    student: [
      { label: 'Fees', sub: 'View and pay fees', icon: BarChart3, color: '#1976d2', bg: '#e3f2fd', page: 'StudentFees' },
      { label: 'Progress Card', sub: 'View progress reports', icon: FileText, color: '#e91e63', bg: '#fce4ec', page: 'Results' },
      { label: 'Quiz', sub: 'Daily quizzes', icon: HelpCircle, color: '#f57c00', bg: '#fff3e0', page: 'Quiz' },
      { label: 'Gallery', sub: 'School photos', icon: Image, color: '#00796b', bg: '#e0f2f1', page: 'Gallery' },
      { label: 'Profile', sub: 'My profile & details', icon: UserIcon, color: '#5c6bc0', bg: '#e8eaf6', page: 'UserProfile' },
      { label: 'Change Password', sub: 'Update your password', icon: Shield, color: '#7e57c2', bg: '#ede7f6', page: 'StudentProfile' },
    ],
  };

  const allContentItems = [
   { label: 'Take Attendance', sub: 'Mark daily attendance', icon: ClipboardCheck, color: '#26a69a', bg: '#e0f2f1', page: 'Attendance', permKey: 'attendance' },
   { label: 'Post Notice', sub: 'Create school announcement', icon: Megaphone, color: '#43a047', bg: '#e8f5e9', page: 'Notices', permKey: 'post_notices' },
   { label: 'Messages', sub: 'Inbox & send messages', icon: MessageSquare, color: '#1a237e', bg: '#e8eaf6', page: 'Messaging', permKey: null },
   { label: 'Diary', sub: 'Post class diary entries', icon: BookOpen, color: '#e91e63', bg: '#fce4ec', page: 'Diary', permKey: null },
   { label: 'Homework', sub: 'Assign homework', icon: ClipboardList, color: '#f57c00', bg: '#fff3e0', page: 'HomeworkManage', permKey: null },
  ];

  const contentItems = isAdmin
    ? allContentItems
    : allContentItems.filter(item => !item.permKey || !!permissions[item.permKey]);

  const adminItems = [
   { label: 'Students', sub: 'Manage student records', icon: Users, color: '#5c6bc0', bg: '#e8eaf6', page: 'Students' },
   { label: 'Staff Management', sub: 'Create & manage accounts', icon: Users, color: '#e53935', bg: '#ffebee', page: 'StaffManagement' },
   { label: 'Reports', sub: 'Analytics & insights', icon: BookOpen, color: '#78909c', bg: '#eceff1', page: 'ReportsManagement' },
   { label: 'Settings', sub: 'School configuration', icon: Settings, color: '#78909c', bg: '#eceff1', page: 'Settings' },
  ];

  const financeReportItems = [
   { label: 'Additional Fee', sub: 'Add adhoc charges', icon: AlertCircle, color: '#f57c00', bg: '#fff3e0', page: 'Fees', tab: 'adhoc' },
   { label: 'Daily Closing', sub: 'End-of-day summary', icon: FileText, color: '#0288d1', bg: '#e1f5fe', page: 'DailyClosingReport' },
   { label: 'Day Book', sub: 'Daily collections by mode', icon: TrendingUp, color: '#1976d2', bg: '#e3f2fd', page: 'DayBookReport' },
   { label: 'Outstanding / Due', sub: 'Student fee balances', icon: FileText, color: '#e53935', bg: '#ffebee', page: 'OutstandingReport' },
   { label: 'Student Ledger', sub: 'Per-student fee ledger', icon: BookOpen, color: '#7b1fa2', bg: '#f3e5f5', page: 'StudentLedgerReport' },
   { label: 'Collection Report', sub: 'Cash collection details', icon: Award, color: '#388e3c', bg: '#e8f5e9', page: 'CollectionReport' },
   { label: 'Collection by Class', sub: 'Class-wise fee summary', icon: BarChart3, color: '#0097a7', bg: '#e0f7fa', page: 'ClassCollectionSummaryReport' },
   { label: 'Defaulters', sub: 'Follow-up & contact tracking', icon: AlertCircle, color: '#d32f2f', bg: '#ffebee', page: 'DefaultersReport' },
   ];

  const supportItems = [
    { label: 'Contact School', sub: schoolProfile?.phone || '+91 98765 43210', icon: Phone, color: '#e53935', bg: '#ffebee' },
    { label: 'School Website', sub: schoolProfile?.website || 'www.bvmschool.edu', icon: Globe, color: '#1e88e5', bg: '#e3f2fd' },
    { label: 'Privacy Policy', icon: Shield, color: '#7e57c2', bg: '#ede7f6' },
    { label: 'Help & FAQ', icon: HelpCircle, color: '#9c27b0', bg: '#f3e5f5' },
    { label: 'About App', sub: 'Version 2.0.0', icon: Info, color: '#78909c', bg: '#eceff1' },
  ];

  const [expandedExams, setExpandedExams] = useState(false);
  const [expandedFinance, setExpandedFinance] = useState(false);

  const MenuItem = ({ item, onClick, showArrow = true }) => {
    const inner = (
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.bg }}>
          <item.icon className="h-5 w-5" style={{ color: item.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
          {item.sub && <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>}
        </div>
        {showArrow && <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />}
      </div>
    );

    if (onClick) return <div onClick={onClick} className="cursor-pointer">{inner}</div>;
    if (item.page) {
      const url = item.tab ? createPageUrl(item.page) + `?tab=${item.tab}` : createPageUrl(item.page);
      return <Link to={url}>{inner}</Link>;
    }
    return inner;
  };

  return (
    <div className="bg-gray-100 min-h-screen pb-6">

      {/* ---- LOGGED OUT STATE ---- */}
      {!loading && !user ? (
        <>
          {/* Hero Card */}
          <div className="bg-[#1a237e] px-4 pt-6 pb-10">
            <div className="bg-[#283593] rounded-2xl p-6 flex flex-col items-center text-white">
              <div className="w-20 h-20 rounded-2xl bg-[#1a237e] border-2 border-yellow-400 flex items-center justify-center mb-4">
                <GraduationCap className="h-10 w-10 text-yellow-400" />
              </div>
              <p className="font-bold text-xl text-center">{schoolProfile?.school_name || 'BVM School of Excellence'}</p>
              <p className="text-white/60 text-sm mt-1 text-center">{schoolProfile?.tagline || 'Building Future Leaders'}</p>
              <button
                onClick={() => window.location.href = createPageUrl('StaffLogin')}
                className="mt-5 flex items-center gap-2 px-8 py-3 bg-yellow-400 text-gray-900 rounded-full text-sm font-bold transition-colors hover:bg-yellow-300 active:bg-yellow-500 w-full justify-center"
              >
                <LogIn className="h-4 w-4" />
                Login / Sign Up
              </button>
            </div>
          </div>

          {/* Support Section */}
          <div className="-mt-4 px-4 space-y-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
              <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Support</p>
              <div className="divide-y divide-gray-50">
                {supportItems.map(item => <MenuItem key={item.label} item={item} />)}
              </div>
            </div>
            <p className="text-center text-xs text-gray-400 py-2">{schoolProfile?.school_name || 'BVM School of Excellence'}</p>
          </div>
        </>
      ) : (
        <>
           {/* ---- STUDENT SESSION ---- */}
           {studentSession && (
             <div className="-mt-4 px-4 space-y-4 pt-4">
               <StudentExamSectionWithBadges studentSession={studentSession} />
             </div>
           )}

           {/* ---- LOGGED IN STATE ---- */}
           {!studentSession && (
             <>
               <div className="bg-[#1a237e] px-4 pt-6 pb-8">
                 <div className="bg-[#283593] rounded-2xl p-5 flex flex-col items-center text-white">
                   <div className="w-16 h-16 rounded-full bg-[#3949ab] border-2 border-white/30 flex items-center justify-center text-2xl font-bold">
                     {user?.full_name ? user.full_name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() : '?'}
                   </div>
                   {loading ? (
                     <p className="mt-3 text-white/70 text-sm">Loading...</p>
                   ) : (
                     <>
                       <p className="mt-3 font-bold text-lg">{user?.name || user?.full_name}</p>
                          <span className="mt-1 px-3 py-0.5 bg-yellow-400 text-gray-900 text-xs font-bold rounded-full capitalize">
                             {user?.role || 'User'}
                           </span>
                       <button
                         onClick={() => {
                           clearStaffSession();
                           // Clear all cached profile data on logout
                           Object.keys(localStorage).forEach(k => {
                             if (k.startsWith('staff_profile_')) localStorage.removeItem(k);
                           });
                           window.location.replace(createPageUrl('StaffLogin'));
                         }}
                         className="mt-4 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-medium transition-colors"
                       >
                         <LogOut className="h-4 w-4" />
                         Logout
                       </button>
                     </>
                   )}
                 </div>
               </div>

               <div className="-mt-4 px-4 space-y-4">
                 {/* Exam Management - Admin */}
                 {isAdmin && (
                   <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                     <button onClick={() => setExpandedExams(!expandedExams)} className="w-full text-left">
                       <MenuItem 
                         item={{ 
                           label: 'Exam Management', 
                           sub: 'Manage all exam operations',
                           icon: FileText, 
                           color: '#d32f2f', 
                           bg: '#ffebee'
                         }} 
                         showArrow={true}
                       />
                     </button>
                     {expandedExams && (
                       <div className="divide-y divide-gray-50 bg-gray-50">
                         {examItems.admin.map(item => (
                           <div key={item.label} className="pl-4">
                             <MenuItem item={item} />
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 )}

                 {/* Exam Section - Teachers (not accountant) */}
                  {isTeacher && !isAdmin && role !== 'accountant' && examItems.teacher.length > 0 && (
                   <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                     <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Exams</p>
                     <div className="divide-y divide-gray-50">
                       {examItems.teacher.map(item => <MenuItem key={item.label} item={item} />)}
                     </div>
                   </div>
                 )}

                 {/* Create Content - Teachers & Staff (not accountant) */}
                 {isTeacher && role !== 'accountant' && (
                   <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                     <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Create Content</p>
                     <div className="divide-y divide-gray-50">
                       {contentItems.map(item => <MenuItem key={item.label} item={item} />)}
                     </div>
                   </div>
                 )}

                 {/* Finance Reports - Accountant: big buttons, always visible */}
                  {role === 'accountant' && (
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                      <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Finance</p>
                      <div className="divide-y divide-gray-50">
                        {financeReportItems.map(item => (
                          <MenuItem key={item.label} item={item} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Finance Reports - Admin or other staff with fee permissions (collapsible) */}
                  {role !== 'accountant' && canViewFinance && (
                   <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                     <button onClick={() => setExpandedFinance(!expandedFinance)} className="w-full text-left">
                       <MenuItem
                         item={{
                           label: 'Finance Reports',
                           sub: 'Day Book, Outstanding, Ledger',
                           icon: TrendingUp,
                           color: '#1976d2',
                           bg: '#e3f2fd'
                         }}
                         showArrow={true}
                       />
                     </button>
                     {expandedFinance && (
                       <div className="divide-y divide-gray-50 bg-gray-50">
                         {financeReportItems
                           .filter(item => {
                             if (isAdmin) return true;
                             // Show only relevant report items based on permissions
                             if (item.page === 'OutstandingReport') return !!permissions.fee_reports_view || !!permissions.fees_view_ledger;
                             if (item.page === 'StudentLedgerReport') return !!permissions.fees_view_ledger;
                             if (item.page === 'CollectionReport' || item.page === 'DailyClosingReport' || item.page === 'DayBookReport' || item.page === 'ClassCollectionSummaryReport') return !!permissions.fee_reports_view;
                             if (item.page === 'DefaultersReport') return !!permissions.fee_reports_view;
                             return false;
                           })
                           .map(item => (
                           <div key={item.label} className="pl-4">
                             <MenuItem item={item} />
                           </div>
                         ))}
                       </div>
                     )}
                   </div>
                 )}

                 {/* Fees Module shortcut for non-admin, non-accountant fee staff */}
                  {!isAdmin && role !== 'accountant' && !!permissions.fees_view_module && (
                   <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                     <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Fees</p>
                     <div className="divide-y divide-gray-50">
                       <MenuItem item={{ label: 'Fees Module', sub: 'Collect & manage fee payments', icon: TrendingUp, color: '#388e3c', bg: '#e8f5e9', page: 'Fees' }} />
                     </div>
                   </div>
                 )}

                 {/* Admin Controls */}
                 {isAdmin && (
                   <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                     <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Other Controls</p>
                     <div className="divide-y divide-gray-50">
                       {adminItems.map(item => <MenuItem key={item.label} item={item} />)}
                     </div>
                   </div>
                 )}

                 {/* Profile & Account — always visible for ALL logged-in staff */}
                 <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                   <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">My Account</p>
                   <div className="divide-y divide-gray-50">
                     <MenuItem item={{ label: 'My Profile', sub: 'View & edit your profile', icon: UserIcon, color: '#1976d2', bg: '#e3f2fd', page: 'Profile' }} />
                     <MenuItem item={{ label: 'Change Password', sub: 'Update your login password', icon: Shield, color: '#7e57c2', bg: '#ede7f6', page: 'ChangeStaffPassword' }} />
                   </div>
                 </div>

                 {/* Support */}
                 <div className="bg-white rounded-2xl overflow-hidden shadow-sm">
                   <p className="px-4 pt-4 pb-2 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Support</p>
                   <div className="divide-y divide-gray-50">
                     {supportItems.map(item => <MenuItem key={item.label} item={item} />)}
                   </div>
                 </div>

                 <p className="text-center text-xs text-gray-400 py-2">{schoolProfile?.school_name || 'BVM School of Excellence'}</p>
               </div>
             </>
           )}
        </>
      )}
    </div>
  );
}