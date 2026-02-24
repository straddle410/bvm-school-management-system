import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  GraduationCap, Image, Calendar, Brain, Bell, MoreHorizontal,
  ClipboardList, Megaphone, ChevronRight, User, BarChart3, Check,
  FileText, Award, BookOpen, Palmtree, Clock, Book, LogOut,
  CheckCircle, AlertCircle, MessageSquare, Trophy
} from 'lucide-react';
import { format } from 'date-fns';

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
  { label: 'Diary',         icon: Book,          gradient: 'from-pink-400 to-rose-500',       page: 'Diary' },
  { label: 'Student Login', icon: User,          gradient: 'from-orange-400 to-amber-500',    page: 'StudentLogin', guestOnly: true },
];

const quickActions = [
  { label: 'Take Attendance',     icon: Check,         gradient: 'from-blue-400 to-blue-600',     page: 'Attendance',             roleRequired: ['Admin', 'admin', 'Principal', 'principal', 'Teacher', 'teacher'] },
  { label: 'Attendance Summary',  icon: BarChart3,      gradient: 'from-teal-400 to-green-600',    page: 'AttendanceSummaryReport', roleRequired: ['Admin', 'admin', 'Principal', 'principal', 'Teacher', 'teacher'] },
  { label: 'Diary',               icon: Book,          gradient: 'from-rose-400 to-pink-600',     page: 'DiaryManagement',         roleRequired: ['Admin', 'admin', 'Principal', 'principal', 'Teacher', 'teacher'] },
  { label: 'Homework',            icon: BookOpen,      gradient: 'from-orange-400 to-amber-500',  page: 'HomeworkManage',          roleRequired: ['Admin', 'admin', 'Principal', 'principal', 'Teacher', 'teacher'] },
  { label: 'Post Notice',         icon: Megaphone,     gradient: 'from-yellow-400 to-orange-500', page: 'Notices',                 roleRequired: ['Admin', 'admin', 'Principal', 'principal', 'Teacher', 'teacher'] },
  { label: 'Marks Entry',         icon: ClipboardList, gradient: 'from-cyan-400 to-teal-500',     page: 'Marks',                   roleRequired: ['Admin', 'admin', 'Principal', 'principal', 'Teacher', 'teacher'] },
  { label: 'Timetable',           icon: Clock,         gradient: 'from-sky-400 to-indigo-500',    page: 'TimetableManagement',     roleRequired: ['Admin', 'admin', 'Principal', 'principal'] },
];

const adminActions = [
  { label: 'Daily Attendance', icon: Check,         gradient: 'from-blue-500 to-indigo-600',   page: 'AttendanceReport' },
  { label: 'Subjects',         icon: Book,          gradient: 'from-violet-400 to-purple-600', page: 'SubjectManagement' },
  { label: 'Holidays',         icon: Palmtree,      gradient: 'from-yellow-400 to-orange-500', page: 'HolidayCalendar' },
  { label: 'Hall Ticket',      icon: FileText,      gradient: 'from-red-400 to-rose-600',      page: 'HallTicketManagement' },
  { label: 'Review Marks',     icon: ClipboardList, gradient: 'from-indigo-400 to-blue-600',   page: 'MarksReview' },
  { label: 'Progress Card',    icon: Award,         gradient: 'from-amber-400 to-orange-500',  page: 'ExamManagement', tab: 'progress-cards' },
  { label: 'Reports',          icon: BarChart3,     gradient: 'from-sky-400 to-blue-600',      page: 'ReportsManagement' },
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

  useEffect(() => {
    let session = localStorage.getItem('staff_session') || localStorage.getItem('student_session');
    if (session) {
      try { setUser(JSON.parse(session)); } catch {}
    }
  }, []);

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile-dashboard'],
    queryFn: async () => {
      try {
        const profiles = await base44.entities.SchoolProfile.list();
        return profiles[0] || null;
      } catch { return null; }
    }
  });

  const { data: bannerSlides = [] } = useQuery({
    queryKey: ['banner-slides'],
    queryFn: async () => {
      try { return await base44.entities.BannerSlide.filter({ is_active: true }, 'sort_order'); } catch { return []; }
    }
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
      try { return await base44.entities.Notice.filter({ status: 'Published' }); } catch { return []; }
    }
  });

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events-published'],
    queryFn: async () => {
      try { return await base44.entities.CalendarEvent.filter({ status: 'Published' }); } catch { return []; }
    }
  });

  const { data: unreadDiaryCount = 0 } = useQuery({
    queryKey: ['unread-diary-count', user?.student_id],
    queryFn: async () => {
      if (!user?.student_id) return 0;
      try {
        const n = await base44.entities.Notification.filter({ recipient_student_id: user.student_id, type: 'diary_published', is_read: false });
        return n.length;
      } catch { return 0; }
    },
    enabled: !!user?.student_id,
    refetchInterval: 2000
  });

  const { data: latestDiaries = [] } = useQuery({
    queryKey: ['latest-diaries-dashboard'],
    queryFn: async () => {
      try {
        const diaries = await base44.entities.Diary.filter({ status: 'Published' });
        return diaries
          .sort((a, b) => new Date(b.diary_date || b.created_date) - new Date(a.diary_date || a.created_date))
          .slice(0, 3);
      } catch { return []; }
    },
  });

  const recentNotices = [...notices]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 4);

  const upcomingEvents = events
    .filter(e => new Date(e.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 3);

  const isAdmin = user?.role === 'Admin' || user?.role === 'admin' || user?.role === 'Principal' || user?.role === 'principal';
  const isStaff = user && (isAdmin || user?.role === 'Teacher' || user?.role === 'teacher' || user?.role === 'Staff');

  const eventTypeColor = (type) => {
    const map = { Holiday: '#e53935', Exam: '#7e57c2', PTM: '#1e88e5', Event: '#43a047', Meeting: '#f9a825', General: '#26a69a', Urgent: '#d32f2f', Fee: '#f9a825', Notice: '#1e88e5' };
    return map[type] || '#78909c';
  };

  const initials = user?.full_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col max-w-md mx-auto relative">

      {/* Header */}
      <header className="sticky top-0 z-50">
        <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] px-4 pt-4 pb-5 shadow-lg">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-blue-200" />
              <span className="font-bold text-white text-base tracking-wide">School Portal</span>
            </div>
            {user && (
              <button
                onClick={() => { localStorage.removeItem('staff_session'); localStorage.removeItem('student_session'); window.location.reload(); }}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-full transition-all"
              >
                <LogOut className="h-3.5 w-3.5" /> Logout
              </button>
            )}
          </div>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center flex-shrink-0 shadow">
                <span className="text-white font-bold text-lg">{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-base leading-tight truncate">{user.full_name || user.name || user.email}</h2>
                <p className="text-blue-200 text-xs capitalize">{user.role || 'Staff'}</p>
              </div>
            </div>
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

      {/* Banner */}
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

      <main className="flex-1 overflow-y-auto pb-24 px-4 py-5 space-y-6">

        {/* Quick Access */}
        <section>
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Access</h2>
          <div className="grid grid-cols-4 gap-3">
            {quickAccess
              .filter(item => !(item.guestOnly && user))
              .map((item) => (
                <Link key={item.label} to={createPageUrl(item.page)} className="block">
                  <div className="flex flex-col items-center gap-1.5 relative">
                    <GradientIcon gradient={item.gradient} icon={item.icon} />
                    {item.label === 'Diary' && unreadDiaryCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
                        {unreadDiaryCount > 9 ? '9+' : unreadDiaryCount}
                      </span>
                    )}
                    <span className="text-[10px] font-semibold text-gray-600 text-center leading-tight">{item.label}</span>
                  </div>
                </Link>
              ))}
          </div>
        </section>

        {/* Quick Actions - staff only */}
        {isStaff && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Quick Actions</h2>
            <div className="grid grid-cols-4 gap-3">
              {quickActions
                .filter(item => !item.roleRequired || item.roleRequired.includes(user?.role))
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

        {/* Admin Tools */}
        {isAdmin && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Admin Tools</h2>
            <div className="grid grid-cols-4 gap-3">
              {adminActions.map((item) => {
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

        {/* Latest Diary */}
        {latestDiaries.length > 0 && (
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

        {/* Notices */}
        {recentNotices.length > 0 && (
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

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
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
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-200 z-50 shadow-lg">
        <div className="flex items-center justify-around py-2">
          {[
            { name: 'Home', icon: MoreHorizontal, page: 'Dashboard' },
            { name: 'Notices', icon: Bell, page: 'Notices' },
            { name: 'Gallery', icon: Image, page: 'Gallery' },
            { name: 'Calendar', icon: Calendar, page: 'Calendar' },
            { name: 'More', icon: MoreHorizontal, page: 'More' },
          ].map((item) => {
            const isActive = false;
            return (
              <Link key={item.page} to={createPageUrl(item.page)}
                className="flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-all text-gray-400">
                <item.icon className="h-6 w-6" />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>

    </div>
  );
}