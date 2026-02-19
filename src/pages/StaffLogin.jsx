import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, LogIn, GraduationCap } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function StaffLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Find staff by username directly from entity
    const staffList = await base44.entities.StaffAccount.filter({ username: username.trim() });

    setLoading(false);

    if (!staffList || staffList.length === 0) {
      setError('Invalid username or password');
      return;
    }

    const staff = staffList[0];

    if (staff.temp_password !== password) {
      setError('Invalid username or password');
      return;
    }

    if (staff.is_active === false) {
      setError('Your account has been deactivated. Contact admin.');
      return;
    }

    // Store staff session in localStorage
    localStorage.setItem('staff_session', JSON.stringify({
      id: staff.id,
      full_name: staff.full_name,
      username: staff.username,
      email: staff.email,
      role: staff.role,
      subjects: staff.subjects,
      classes_assigned: staff.classes_assigned,
    }));
    window.location.href = createPageUrl('Dashboard');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] to-[#283593] flex flex-col items-center justify-center px-4">
      {/* Logo / Branding */}
      <div className="flex flex-col items-center mb-8">
        <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
          <GraduationCap className="h-9 w-9 text-[#1a237e]" />
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight">BVM School of Excellence</h1>
        <p className="text-blue-200 text-sm mt-1">Staff & Teacher Portal</p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Welcome Back</h2>
        <p className="text-sm text-gray-500 mb-6">Login with your username and password</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. ravi.kumar"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1a237e] text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#283593] transition-colors disabled:opacity-60"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                Login
              </>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Contact admin if you forgot your credentials
        </p>
      </div>
    </div>
  );
}