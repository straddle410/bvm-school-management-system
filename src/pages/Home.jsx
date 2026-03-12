import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Building2, ClipboardList, BarChart3, BookOpen, Bell, Calendar, MessageSquare, FileText, Trophy, Phone, Mail, MapPin, Home as HomeIcon } from 'lucide-react';

export default function Home() {
  const [schoolProfile, setSchoolProfile] = useState(null);

  useEffect(() => {
    import('@/api/base44Client').then(({ base44 }) => {
      base44.entities.SchoolProfile.list().then(profiles => {
        if (profiles && profiles.length > 0) setSchoolProfile(profiles[0]);
      }).catch(() => {});
    });
  }, []);

  const schoolName = schoolProfile?.school_name || 'BVM School of Excellence';
  const schoolPhone = schoolProfile?.phone || '+91-98765-43210';
  const schoolEmail = schoolProfile?.email || 'info@school.com';
  const schoolAddress = schoolProfile?.address || '123 School Lane, City, State 12345';
  const schoolWebsite = schoolProfile?.website || 'www.school.edu';

  const features = [
    { icon: ClipboardList, label: 'Attendance', color: '#26a69a', bgClass: 'bg-teal-50 dark:bg-teal-900/20' },
    { icon: BarChart3, label: 'Marks', color: '#1976d2', bgClass: 'bg-blue-50 dark:bg-blue-900/20' },
    { icon: BookOpen, label: 'Homework', color: '#f57c00', bgClass: 'bg-orange-50 dark:bg-orange-900/20' },
    { icon: Bell, label: 'Notices', color: '#1a237e', bgClass: 'bg-indigo-50 dark:bg-indigo-900/20' },
    { icon: Calendar, label: 'Timetable', color: '#6a1b9a', bgClass: 'bg-purple-50 dark:bg-purple-900/20' },
    { icon: MessageSquare, label: 'Messages', color: '#0288d1', bgClass: 'bg-sky-50 dark:bg-sky-900/20' },
    { icon: FileText, label: 'Diary', color: '#e91e63', bgClass: 'bg-pink-50 dark:bg-pink-900/20' },
    { icon: Trophy, label: 'Results', color: '#388e3c', bgClass: 'bg-green-50 dark:bg-green-900/20' },
  ];

  const announcements = [
    { date: 'Today', title: 'Classes will resume at 9:00 AM', content: 'All classes have been rescheduled due to the holiday.' },
    { date: 'Yesterday', title: 'Annual sports day scheduled', content: 'The annual sports day will be held next month.' },
    { date: '2 days ago', title: 'Mid-term exam results published', content: 'Check your marks in the student portal.' },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] to-[#f5f7ff] dark:from-gray-900 dark:to-gray-900 dark:bg-gray-900 flex flex-col">
      {/* Header / Navigation */}
      <nav className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to={createPageUrl('Home')} className="flex items-center gap-3 hover:opacity-90 transition">
            <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">{schoolName.toUpperCase()}</h1>
            </div>
          </Link>
          <div className="flex gap-2">
            <Link to={createPageUrl('StudentLogin')}>
              <Button variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20">
                Student Login
              </Button>
            </Link>
            <Link to={createPageUrl('StaffLogin')}>
              <Button className="bg-white text-[#1a237e] hover:bg-gray-100 font-semibold">
                Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to the School Portal
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
            Access attendance, marks, notices, homework, and school updates all in one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to={createPageUrl('StudentLogin')}>
              <Button className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white hover:opacity-90 text-base px-8 py-6">
                Student Login
              </Button>
            </Link>
            <Link to={createPageUrl('StaffLogin')}>
              <Button variant="outline" className="border-[#1a237e] text-[#1a237e] hover:bg-[#f0f4ff] text-base px-8 py-6">
                Staff Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-4 py-12 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-10">
            What's Inside
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.label}
                  className={`rounded-2xl p-6 text-center transition-transform hover:scale-105 ${feature.bgClass}`}
                >
                  <div className="flex justify-center mb-3">
                    <div className="p-3 rounded-xl bg-white/60 dark:bg-gray-700/60">
                      <Icon className="h-6 w-6" style={{ color: feature.color }} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{feature.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Announcements Section */}
      <section className="px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">
            Latest Announcements
          </h3>
          <div className="space-y-4">
            {announcements.map((announcement, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border-l-4 border-[#3949ab]">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-gray-900 dark:text-white">{announcement.title}</h4>
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-full">
                    {announcement.date}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{announcement.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="px-4 py-12 bg-white/50 dark:bg-gray-800/50">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
            Contact Us
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <MapPin className="h-6 w-6 text-[#1a237e] dark:text-blue-400" />
                </div>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Address</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">{schoolAddress}</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Phone className="h-6 w-6 text-[#1a237e] dark:text-blue-400" />
                </div>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Phone</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">{schoolPhone}</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Mail className="h-6 w-6 text-[#1a237e] dark:text-blue-400" />
                </div>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">Email</h4>
              <p className="text-sm text-gray-600 dark:text-gray-300">{schoolEmail}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-6 pb-6 border-b border-white/20">
            <div>
              <h3 className="font-bold text-lg mb-2">Quick Links</h3>
              <ul className="space-y-1 text-sm text-blue-100">
                <li><Link to={createPageUrl('Home')} className="hover:text-white transition">Home</Link></li>
                <li><Link to={createPageUrl('StudentLogin')} className="hover:text-white transition">Student Portal</Link></li>
                <li><Link to={createPageUrl('StaffLogin')} className="hover:text-white transition">Staff Portal</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Contact</h3>
              <ul className="space-y-1 text-sm text-blue-100">
                <li>Phone: {schoolPhone}</li>
                <li>Email: {schoolEmail}</li>
                <li>{schoolAddress}</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-2">Hours</h3>
              <ul className="space-y-1 text-sm text-blue-100">
                <li>Mon - Fri: 9:00 AM - 4:00 PM</li>
                <li>Saturday: 9:00 AM - 1:00 PM</li>
                <li>Sunday: Closed</li>
              </ul>
            </div>
          </div>
          <div className="text-center text-sm text-blue-100">
            <p>© {currentYear} {schoolName}. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}