import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Clock, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CleanerDashboard() {
  const [staffName, setStaffName] = useState('');
  const [schoolName, setSchoolName] = useState('BVM School');
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    // Load name from session
    try {
      const session = JSON.parse(localStorage.getItem('staff_session') || '{}');
      setStaffName(session.name || session.full_name || 'Staff');
    } catch {}

    // Load school profile
    base44.entities.SchoolProfile.list().then(p => {
      if (p?.[0]?.school_name) setSchoolName(p[0].school_name);
    }).catch(() => {});

    // Clock
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('staff_session');
    sessionStorage.clear();
    window.location.href = '/StaffLogin';
  };

  const formatTime = (d) =>
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatDate = (d) =>
    d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex flex-col items-center justify-center px-6 py-12 gap-8">

      {/* School name */}
      <p className="text-white/70 text-sm font-medium tracking-wide text-center">{schoolName}</p>

      {/* Clock */}
      <div className="text-center">
        <p className="text-6xl font-bold text-white tracking-tight">{formatTime(time)}</p>
        <p className="text-white/60 text-sm mt-1">{formatDate(time)}</p>
      </div>

      {/* Welcome card */}
      <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 w-full max-w-sm text-center space-y-4">
        <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto">
          <Sparkles className="h-8 w-8 text-yellow-300" />
        </div>
        <div>
          <p className="text-white/70 text-xs uppercase tracking-widest mb-1">Welcome</p>
          <h1 className="text-2xl font-bold text-white">{staffName}</h1>
          <p className="text-white/50 text-sm mt-1">Housekeeping Staff</p>
        </div>

        <div className="bg-white/10 rounded-2xl p-4 text-left space-y-2">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-white/60 flex-shrink-0" />
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wider">Shift</p>
              <p className="text-white text-sm font-medium">Morning — 7:00 AM to 2:00 PM</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <User className="h-4 w-4 text-white/60 flex-shrink-0" />
            <div>
              <p className="text-white/50 text-[10px] uppercase tracking-wider">Role</p>
              <p className="text-white text-sm font-medium">Cleaner / Housekeeping</p>
            </div>
          </div>
        </div>

        <p className="text-white/40 text-xs">Contact admin for any assistance.</p>
      </div>

      {/* Logout */}
      <Button
        onClick={handleLogout}
        variant="ghost"
        className="text-white/60 hover:text-white hover:bg-white/10 gap-2"
      >
        <LogOut className="h-4 w-4" /> Sign Out
      </Button>
    </div>
  );
}