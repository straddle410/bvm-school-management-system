import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import StudentMinimalFooterNav from '@/components/StudentMinimalFooterNav';

function getStudentSession() {
  try { return JSON.parse(localStorage.getItem('student_session')); } catch { return null; }
}

export default function StudentChangePassword() {
  const [student, setStudent] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const isForced = new URLSearchParams(window.location.search).get('forced') === '1';

  useEffect(() => {
    const s = getStudentSession();
    if (!s) { window.location.href = createPageUrl('StudentLogin'); return; }
    setStudent(s);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
      setError('Password must contain at least one letter.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await base44.functions.invoke('studentChangePassword', {
        student_db_id: student.id,
        student_id: student.student_id,
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (res.data?.success) {
        // Clear forced flag from session
        try {
          const raw = localStorage.getItem('student_session');
          if (raw) {
            const s = JSON.parse(raw);
            s.must_change_password = false;
            localStorage.setItem('student_session', JSON.stringify(s));
          }
        } catch {}
        setSuccess(true);
        toast.success('Password changed successfully!');
      } else {
        setError(res.data?.error === 'WRONG_PASSWORD'
          ? 'Current password is incorrect.'
          : res.data?.error || 'Failed to change password.');
      }
    } catch {
      setError('Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!student) return null;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => { window.location.href = createPageUrl('StudentLogin'); }} className="p-1 hover:bg-white/20 rounded-lg transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">Change Password</h1>
            <p className="text-sm text-blue-100">{student.name}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 px-4 py-6">
        {success ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Password Changed!</h2>
            <p className="text-gray-500 text-sm mb-6">Your password has been updated successfully.</p>
            <button
              onClick={() => { window.location.href = createPageUrl('StudentDashboard'); }}
              className="w-full bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-3 rounded-xl font-bold text-sm"
            >
              Back to Dashboard
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm p-6">
            {isForced && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-medium">
                🔒 You must set a new password before continuing.
              </div>
            )}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 bg-indigo-100 rounded-xl flex items-center justify-center">
                <Lock className="h-6 w-6 text-[#1a237e]" />
              </div>
              <div>
                <p className="font-semibold text-gray-800">Update Password</p>
                <p className="text-xs text-gray-500">Choose a strong password to secure your account</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Current Password */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
                  />
                  <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    placeholder="Min 6 chars, at least 1 letter & 1 number"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Re-enter new password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-gray-50"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  ⚠ {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-60 mt-2"
              >
                {loading ? 'Saving...' : 'Change Password'}
              </button>
            </form>
          </div>
        )}
      </div>

      <StudentMinimalFooterNav />
    </div>
  );
}