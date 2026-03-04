import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useApprovalsCount } from '@/components/ApprovalsCountBadge';
import { ClipboardCheck, CheckSquare, BookOpen, BookMarked, Bell, Image, Notebook, ListChecks, Calendar, MessageSquare, MoreHorizontal, AlertCircle } from 'lucide-react';

export default function Dashboard() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [latestDiaries, setLatestDiaries] = useState([]);
  const [recentNotices, setRecentNotices] = useState([]);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const approvalsCount = useApprovalsCount(academicYear, isAdmin);

  useEffect(() => {
    loadDashboard();
  }, [academicYear]);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);
      
      // Get user role from staff session
      let staffRole = '';
      try {
        const staffRaw = localStorage.getItem('staff_session');
        if (staffRaw) {
          const staffUser = JSON.parse(staffRaw);
          staffRole = (staffUser.role || '').toLowerCase();
          setUser(staffUser);
        }
      } catch (e) {
        console.log('No staff session:', e);
      }

      // Fall back to auth.me() if no staff session
      if (!staffRole) {
        try {
          const currentUser = await base44.auth.me().catch(() => null);
          if (currentUser) {
            staffRole = (currentUser.role || '').toLowerCase();
            setUser(currentUser);
          }
        } catch (e) {
          console.log('No auth session:', e);
        }
      }

      setUserRole(staffRole);
      setIsAdmin(staffRole === 'admin' || staffRole === 'principal');
      setIsTeacher(staffRole === 'teacher');

      console.log('DEBUG Dashboard:', {
        userRole: staffRole,
        isTeacher: staffRole === 'teacher',
        isAdmin: staffRole === 'admin' || staffRole === 'principal',
        academicYear,
      });

      // Load latest diaries and notices if not accountant
      if (staffRole !== 'accountant') {
        try {
          const diaries = await base44.entities.Diary.list('-created_date', 3);
          setLatestDiaries(diaries || []);
        } catch (e) {
          console.log('Error loading diaries:', e);
        }

        try {
          const notices = await base44.entities.Notice.list('-publish_date', 5);
          setRecentNotices(notices || []);
        } catch (e) {
          console.log('Error loading notices:', e);
        }
      }
    } catch (e) {
      console.error('Error loading dashboard:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Quick actions for teachers
  const quickActions = [
    { label: 'Attendance', icon: CheckSquare, page: 'Attendance', gradient: 'from-blue-400 to-blue-600' },
    { label: 'Marks Entry', icon: BookOpen, page: 'Marks', gradient: 'from-green-400 to-green-600' },
    { label: 'Homework', icon: BookMarked, page: 'Homework', gradient: 'from-purple-400 to-purple-600' },
    { label: 'Diary', icon: Notebook, page: 'Diary', gradient: 'from-pink-400 to-pink-600' },
    { label: 'Notices', icon: Bell, page: 'Notices', gradient: 'from-yellow-400 to-yellow-600' },
    { label: 'Quiz', icon: ListChecks, page: 'Quiz', gradient: 'from-indigo-400 to-indigo-600' },
    { label: 'Gallery', icon: Image, page: 'Gallery', gradient: 'from-orange-400 to-orange-600' },
    { label: 'Messages', icon: MessageSquare, page: 'Messaging', gradient: 'from-teal-400 to-teal-600' },
    { label: 'Timetable', icon: Calendar, page: 'TimetableManagement', gradient: 'from-cyan-400 to-cyan-600' },
  ];

  const GradientIcon = ({ gradient, icon: Icon }) => (
    <div className={`bg-gradient-to-br ${gradient} p-3 rounded-2xl text-white`}>
      <Icon className="h-6 w-6" />
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-[#1a237e] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Welcome section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome, {user?.name || 'Teacher'}
          </h1>
          <p className="text-gray-600 mt-1">
            {academicYear && `Academic Year: ${academicYear}`}
          </p>
        </div>

        {/* Quick Actions Section */}
        <section className="mb-8">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Quick Actions</h2>
          
          {isTeacher && quickActions.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {quickActions.map((item) => {
                const href = createPageUrl(item.page);
                return (
                  <Link key={item.label} to={href} className="block">
                    <div className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col items-center gap-3">
                      <GradientIcon gradient={item.gradient} icon={item.icon} />
                      <span className="text-[11px] font-semibold text-gray-700 text-center leading-tight">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : isTeacher ? (
            <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-amber-500 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-gray-900">No actions available</p>
                <p className="text-sm text-gray-600">Contact your administrator for permissions.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 shadow-sm border-l-4 border-blue-500">
              <p className="text-gray-600">Dashboard content for your role will appear here.</p>
            </div>
          )}
        </section>

        {/* Approvals for admin */}
        {isAdmin && approvalsCount > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-700 mb-4">Pending Approvals</h2>
            <Link to={createPageUrl('Approvals')} className="block">
              <div className="bg-red-50 rounded-2xl p-4 shadow-sm border border-red-200 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="bg-red-500 text-white rounded-full w-10 h-10 flex items-center justify-center font-bold">
                    {approvalsCount > 9 ? '9+' : approvalsCount}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">Pending Items</p>
                    <p className="text-sm text-gray-600">Review and approve pending submissions</p>
                  </div>
                </div>
              </div>
            </Link>
          </section>
        )}

        {/* Latest Diaries */}
        {!isAdmin && latestDiaries.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-gray-700 mb-4">Latest Diary Entries</h2>
            <div className="space-y-3">
              {latestDiaries.map((diary) => (
                <div key={diary.id} className="bg-white rounded-2xl p-4 shadow-sm border-l-4 border-pink-500">
                  <p className="font-semibold text-gray-900">{diary.title}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Class {diary.class_name} • {diary.subject}
                  </p>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{diary.description}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Notices */}
        {!isAdmin && recentNotices.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-700 mb-4">Recent Notices</h2>
            <div className="space-y-3">
              {recentNotices.slice(0, 3).map((notice) => (
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