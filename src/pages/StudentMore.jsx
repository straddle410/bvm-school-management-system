import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { HelpCircle, BarChart3, FileText, Image, User, Shield, LogOut, Lock, Eye, EyeOff, X, ArrowLeft } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function StudentMore() {
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showPw, setShowPw] = useState({ current: false, newPw: false, confirm: false });

  useEffect(() => {
    const raw = sessionStorage.getItem('student_session') || localStorage.getItem('student_session');
    let parsedSession = null;
    try { parsedSession = raw ? JSON.parse(raw) : null; } catch (e) {}
    
    if (!parsedSession) {
      navigate(createPageUrl('StudentLogin'));
      return;
    }
    setSession(parsedSession);

    base44.entities.SchoolProfile.list()
      .then(p => p.length && setSchoolProfile(p[0]))
      .catch(() => {});
  }, [navigate]);

  const handleLogout = () => {
    sessionStorage.removeItem('student_session');
    localStorage.removeItem('student_session');
    navigate(createPageUrl('StudentLogin'));
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pwForm.newPw !== pwForm.confirm) { setPwError('New passwords do not match'); return; }
    if (pwForm.newPw.length < 6) { setPwError('Password must be at least 6 characters'); return; }
    setPwLoading(true);
    try {
      const res = await base44.functions.invoke('studentChangePassword', {
        student_id: session.id,
        current_password: pwForm.current,
        new_password: pwForm.newPw,
      });
      if (res.data?.error) {
        setPwError(res.data.error);
        setPwLoading(false);
        return;
      }
      toast.success('Password changed successfully');
      setShowChangePassword(false);
      setPwForm({ current: '', newPw: '', confirm: '' });
    } catch (err) {
      setPwError(err?.response?.data?.error || 'Failed to change password. Try again.');
    }
    setPwLoading(false);
  };

  if (!session) return null;

  const menuItems = [
    { label: 'Fees', sub: 'View and pay fees', icon: BarChart3, color: '#1976d2', bg: '#e3f2fd', page: 'StudentFees' },
    { label: 'Progress Card', sub: 'View progress reports', icon: FileText, color: '#e91e63', bg: '#fce4ec', page: 'Results' },
    { label: 'Diary', sub: 'Class diary entries', icon: FileText, color: '#e91e63', bg: '#fce4ec', page: 'StudentDiary' },
    { label: 'Quiz', sub: 'Take quizzes', icon: HelpCircle, color: '#f57c00', bg: '#fff3e0', page: 'Quiz' },
    { label: 'Gallery', sub: 'School photos', icon: Image, color: '#00796b', bg: '#e0f2f1', page: 'Gallery' },
    { label: 'Profile', sub: 'View your profile', icon: User, color: '#5c6bc0', bg: '#e8eaf6', page: 'StudentProfile' },
  ];

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">More</h1>
        <p className="text-sm text-blue-100">Additional options</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#1a237e] to-[#3949ab] flex items-center justify-center text-white font-bold">
              {session.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="font-bold text-gray-900">{session.name}</p>
              <p className="text-xs text-gray-500">Class {session.class_name}-{session.section}</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          {menuItems.map((item) => (
            <Link
              key={item.label}
              to={createPageUrl(item.page)}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.bg }}>
                <item.icon className="h-5 w-5" style={{ color: item.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">{item.sub}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Account Section */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
          <p className="px-4 pt-3.5 pb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Account</p>
          <button
           onClick={() => setShowChangePassword(true)}
           className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Shield className="h-5 w-5 text-purple-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900">Change Password</p>
              <p className="text-xs text-gray-500 mt-0.5">Update your password</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
              <LogOut className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900">Logout</p>
              <p className="text-xs text-gray-500 mt-0.5">Sign out of your account</p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 py-4">
          {schoolProfile?.school_name || 'BVM School of Excellence'}
        </p>
        </div>

        {/* Change Password Modal */}
         {showChangePassword && session && (
         <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
           <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
             <div className="flex items-center justify-between mb-4">
               <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                 <Lock className="h-5 w-5 text-[#1a237e]" /> Change Password
               </h2>
               <button onClick={() => { setShowChangePassword(false); setPwError(''); }} className="text-gray-400 hover:text-gray-600">
                 <X className="h-5 w-5" />
               </button>
             </div>
             <form onSubmit={handleChangePassword} className="space-y-4">
               {[
                 { label: 'Current Password', key: 'current' },
                 { label: 'New Password', key: 'newPw' },
                 { label: 'Confirm New Password', key: 'confirm' },
               ].map(({ label, key }) => (
                 <div key={key}>
                   <label className="text-sm font-medium text-gray-700 block mb-1.5">{label}</label>
                   <div className="relative">
                     <input
                       type={showPw[key] ? 'text' : 'password'}
                       value={pwForm[key]}
                       onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                       required
                       placeholder={label}
                       className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
                     />
                     <button type="button" onClick={() => setShowPw(s => ({ ...s, [key]: !s[key] }))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                       {showPw[key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                     </button>
                   </div>
                 </div>
               ))}
               {pwError && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{pwError}</div>}
               <div className="flex gap-2 pt-1">
                 <button type="button" onClick={() => { setShowChangePassword(false); setPwError(''); }} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-2.5 text-sm font-semibold">
                   Cancel
                 </button>
                 <button type="submit" disabled={pwLoading} className="flex-1 bg-[#1a237e] text-white rounded-xl py-2.5 text-sm font-semibold disabled:opacity-60">
                   {pwLoading ? 'Saving...' : 'Change Password'}
                 </button>
               </div>
             </form>
           </div>
         </div>
         )}
         </div>
         );
        }