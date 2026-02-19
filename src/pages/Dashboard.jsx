import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  GraduationCap, Image, Calendar, Brain, Bell, MoreHorizontal,
  ClipboardList, Megaphone, MessageCircle, ChevronRight, User, BarChart3
} from 'lucide-react';
import { format } from 'date-fns';

const DEFAULT_BANNERS = [
  { url: 'https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=800&q=80', caption: 'Science Exhibition Winners - Proud Moments' },
  { url: 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=80', caption: 'Annual Day Celebrations 2024' },
  { url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=800&q=80', caption: 'Sports Day - Champions at Heart' },
];

const quickAccess = [
  { label: 'Results', icon: GraduationCap, color: '#5c6bc0', bg: '#e8eaf6', page: 'Results' },
  { label: 'Gallery', icon: Image, color: '#ab47bc', bg: '#f3e5f5', page: 'Gallery' },
  { label: 'Calendar', icon: Calendar, color: '#26a69a', bg: '#e0f2f1', page: 'Calendar' },
  { label: 'Quiz', icon: Brain, color: '#7e57c2', bg: '#ede7f6', page: 'Quiz' },
  { label: 'Notices', icon: Bell, color: '#26c6da', bg: '#e0f7fa', page: 'Notices' },
  { label: 'More', icon: MoreHorizontal, color: '#ef6c00', bg: '#fff3e0', page: 'More' },
];

const quickActions = [
  { label: 'Marks Entry', icon: ClipboardList, color: '#26a69a', page: 'Marks' },
  { label: 'Post Notice', icon: Megaphone, color: '#ef6c00', page: 'Notices' },
  { label: 'Results', icon: MessageCircle, color: '#e53935', page: 'Results' },
];

const adminActions = [
  { label: 'Review Marks', icon: ClipboardList, color: '#1a237e', page: 'MarksReview' },
];

export default function Dashboard() {
  const [bannerIndex, setBannerIndex] = useState(0);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Check staff session from localStorage (custom login)
    const session = localStorage.getItem('staff_session');
    if (session) {
      try { setUser(JSON.parse(session)); } catch {}
    }
  }, []);

  const { data: bannerSlides = [] } = useQuery({
    queryKey: ['banner-slides'],
    queryFn: () => base44.entities.BannerSlide.filter({ is_active: true }, 'sort_order')
  });

  const banners = bannerSlides.length > 0
    ? bannerSlides.map(s => ({ url: s.image_url, caption: s.caption }))
    : DEFAULT_BANNERS;

  useEffect(() => {
    const timer = setInterval(() => {
      setBannerIndex(i => (i + 1) % (banners.length || 1));
    }, 3500);
    return () => clearInterval(timer);
  }, [banners.length]);

  const { data: events = [] } = useQuery({
    queryKey: ['calendar-events-published'],
    queryFn: () => base44.entities.CalendarEvent.filter({ status: 'Published' })
  });

  const { data: notices = [] } = useQuery({
    queryKey: ['notices-published'],
    queryFn: () => base44.entities.Notice.filter({ status: 'Published' })
  });

  const upcomingEvents = events
    .filter(e => new Date(e.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 3);

  const recentNotices = notices
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 3);

  const announcements = [
    ...recentNotices.map(n => ({
      id: n.id,
      title: n.title,
      date: n.publish_date || n.created_date,
      type: n.notice_type || 'Notice'
    })),
    ...upcomingEvents.map(e => ({
      id: e.id,
      title: e.title,
      date: e.start_date,
      type: e.event_type
    }))
  ].slice(0, 5);

  const eventTypeColor = (type) => {
    const map = {
      Holiday: '#e53935',
      Exam: '#7e57c2',
      PTM: '#1e88e5',
      Event: '#43a047',
      Meeting: '#f9a825',
      General: '#26a69a',
      Urgent: '#d32f2f',
      Fee: '#f9a825',
      Notice: '#1e88e5',
    };
    return map[type] || '#78909c';
  };

  return (
    <div className="bg-gray-100 min-h-screen">
      {/* Banner Slider */}
      <div className="relative w-full overflow-hidden" style={{ height: 200 }}>
        {banners.map((img, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-700"
            style={{ opacity: i === bannerIndex ? 1 : 0 }}
          >
            <img src={img.url} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <p className="absolute bottom-4 left-4 right-4 text-white font-bold text-base leading-tight">
              {img.caption}
            </p>
          </div>
        ))}
        {/* Dots */}
        <div className="absolute bottom-2 right-4 flex gap-1.5">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setBannerIndex(i)}
              className={`rounded-full transition-all ${i === bannerIndex ? 'w-5 h-2 bg-yellow-400' : 'w-2 h-2 bg-white/60'}`}
            />
          ))}
        </div>
      </div>

      {/* User Bar (only when logged in) */}
      {user && (
        <div className="px-4 pt-3">
          <Link to={createPageUrl('Profile')}>
            <div className="bg-white rounded-2xl px-4 py-3 flex items-center gap-3 shadow-sm">
              <div className="h-9 w-9 rounded-full bg-[#e8eaf6] flex items-center justify-center flex-shrink-0">
                <User className="h-5 w-5 text-[#1a237e]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name || user.email}</p>
                <p className="text-xs text-gray-500 capitalize">{user.role || 'User'}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </div>
          </Link>
        </div>
      )}

      <div className="px-4 py-4 space-y-6">
        {/* Quick Access */}
        <div>
          <h2 className="text-base font-bold text-gray-800 mb-3">Quick Access</h2>
          <div className="grid grid-cols-3 gap-3">
            {quickAccess.map((item) => (
              <Link key={item.label} to={createPageUrl(item.page)}>
                <div className="bg-white rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm relative">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ backgroundColor: item.bg }}
                  >
                    <item.icon className="h-6 w-6" style={{ color: item.color }} />
                  </div>
                  {item.badge && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center font-bold">
                      {item.badge}
                    </span>
                  )}
                  <span className="text-xs font-medium text-gray-700">{item.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Quick Actions - staff only */}
        {user && (
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-3">Quick Actions</h2>
            <div className="grid grid-cols-3 gap-3">
              {quickActions.map((item) => (
                <Link key={item.label} to={createPageUrl(item.page)}>
                  <div className="bg-white rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm">
                    <item.icon className="h-7 w-7" style={{ color: item.color }} />
                    <span className="text-xs font-medium text-gray-700 text-center">{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Admin Actions - admin/principal only */}
        {user && (user.role === 'Admin' || user.role === 'admin' || user.role === 'Principal' || user.role === 'principal') && (
          <div>
            <h2 className="text-base font-bold text-gray-800 mb-3">Admin Tools</h2>
            <div className="grid grid-cols-3 gap-3">
              {adminActions.map((item) => (
                <Link key={item.label} to={createPageUrl(item.page)}>
                  <div className="bg-white rounded-2xl p-3 flex flex-col items-center gap-2 shadow-sm border-2 border-blue-100">
                    <item.icon className="h-7 w-7" style={{ color: item.color }} />
                    <span className="text-xs font-medium text-gray-700 text-center">{item.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Announcements */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-gray-800">Announcements</h2>
            <Link to={createPageUrl('Notices')} className="flex items-center text-xs text-blue-600 font-medium">
              View All <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {announcements.length > 0 ? announcements.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <div
                  className="w-2 h-10 rounded-full flex-shrink-0"
                  style={{ backgroundColor: eventTypeColor(item.type) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {item.date ? format(new Date(item.date), 'MMM d, yyyy') : ''}
                  </p>
                </div>
                <span
                  className="text-[10px] font-semibold px-2 py-1 rounded-full"
                  style={{ color: eventTypeColor(item.type), backgroundColor: eventTypeColor(item.type) + '20' }}
                >
                  {item.type}
                </span>
              </div>
            )) : (
              <div className="bg-white rounded-2xl p-6 text-center text-gray-400 shadow-sm">
                No announcements yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}