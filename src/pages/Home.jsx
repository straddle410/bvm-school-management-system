import React from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Building2, ClipboardList, BarChart3, BookOpen, Bell, Calendar, MessageSquare, FileText, Trophy, Phone, Mail, MapPin, Home as HomeIcon } from 'lucide-react';

export default function Home() {
  const features = [
    { icon: ClipboardList, label: 'Attendance', color: '#26a69a', bg: '#e0f2f1' },
    { icon: BarChart3, label: 'Marks', color: '#1976d2', bg: '#e3f2fd' },
    { icon: BookOpen, label: 'Homework', color: '#f57c00', bg: '#fff3e0' },
    { icon: Bell, label: 'Notices', color: '#1a237e', bg: '#e8eaf6' },
    { icon: Calendar, label: 'Timetable', color: '#6a1b9a', bg: '#f3e5f5' },
    { icon: MessageSquare, label: 'Messages', color: '#0288d1', bg: '#e1f5fe' },
    { icon: FileText, label: 'Diary', color: '#e91e63', bg: '#fce4ec' },
    { icon: Trophy, label: 'Results', color: '#388e3c', bg: '#e8f5e9' },
  ];

  const announcements = [
    { date: 'Today', title: 'Classes will resume at 9:00 AM', content: 'All classes have been rescheduled due to the holiday.' },
    { date: 'Yesterday', title: 'Annual sports day scheduled', content: 'The annual sports day will be held next month.' },
    { date: '2 days ago', title: 'Mid-term exam results published', content: 'Check your marks in the student portal.' },
  ];

  const currentYear = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f0f4ff] to-[#f5f7ff] flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-lg sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">BVM School</h1>
              <p className="text-xs text-blue-100">School of Excellence</p>
            </div>
          </div>
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
      </header>

      {/* Hero Section */}
      <section className="flex-1 flex items-center justify-center px-4 py-12 sm:py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Welcome to the School Portal
          </h2>
          <p className="text-lg text-gray-600 mb-8">
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
      <section className="px-4 py-12 bg-white/50">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-10">
            What's Inside
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.label}
                  className="rounded-2xl p-6 text-center transition-transform hover:scale-105"
                  style={{ backgroundColor: feature.bg }}
                >
                  <div className="flex justify-center mb-3">
                    <div className="p-3 rounded-xl" style={{ backgroundColor: feature.color + '20' }}>
                      <Icon className="h-6 w-6" style={{ color: feature.color }} />
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{feature.label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Announcements Section */}
      <section className="px-4 py-12">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">
            Latest Announcements
          </h3>
          <div className="space-y-4">
            {announcements.map((announcement, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-[#3949ab]">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-bold text-gray-900">{announcement.title}</h4>
                  <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {announcement.date}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{announcement.content}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="px-4 py-12 bg-white/50">
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Contact Us
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-lg bg-blue-100">
                  <MapPin className="h-6 w-6 text-[#1a237e]" />
                </div>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Address</h4>
              <p className="text-sm text-gray-600">123 School Lane, City, State 12345</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Phone className="h-6 w-6 text-[#1a237e]" />
                </div>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Phone</h4>
              <p className="text-sm text-gray-600">+91-98765-43210</p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-3">
                <div className="p-3 rounded-lg bg-blue-100">
                  <Mail className="h-6 w-6 text-[#1a237e]" />
                </div>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Email</h4>
              <p className="text-sm text-gray-600">info@school.com</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-6 text-center">
        <p className="text-sm">© {currentYear} BVM School of Excellence. All rights reserved.</p>
      </footer>
    </div>
  );
}