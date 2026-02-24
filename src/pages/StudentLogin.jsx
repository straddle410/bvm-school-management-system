import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, LogIn, GraduationCap, ArrowLeft, Lock, User } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { Link } from 'react-router-dom';

export default function StudentLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const searchTerm = username.trim();
      const allStudents = await base44.entities.Student.list();
      const student = allStudents.find(s =>
        (s.username && s.username.toLowerCase() === searchTerm.toLowerCase()) ||
        (s.student_id && s.student_id === searchTerm)
      );
      if (!student) { setError('Invalid username or password'); setLoading(false); return; }
      const storedPassword = student.password || 'BVM123';
      if (password !== storedPassword) { setError('Invalid username or password'); setLoading(false); return; }

      localStorage.setItem('student_session', JSON.stringify({
        id: student.id,
        student_id: student.student_id,
        username: student.username,
        name: student.name,
        class_name: student.class_name,
        section: student.section,
        roll_no: student.roll_no,
        photo_url: student.photo_url,
        academic_year: student.academic_year,
        parent_name: student.parent_name,
        parent_phone: student.parent_phone,
      }));
      window.location.href = createPageUrl('StudentDashboard');
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-blue-200/40 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-100/30 rounded-full blur-3xl" />
      </div>

      <Link
        to={createPageUrl('Dashboard')}
        className="absolute top-5 left-5 z-20 flex items-center gap-1.5 text-indigo-700 bg-white/80 backdrop-blur-sm hover:bg-white px-3 py-2 rounded-xl text-sm font-medium shadow-sm transition-all"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <div className="flex-1 flex flex-col items-center justify-center px-5 relative z-10">

        {/* Logo / Branding */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-[#1a237e] to-[#3949ab] rounded-3xl flex items-center justify-center shadow-xl mb-4">
            <GraduationCap className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-extrabold text-gray-800 tracking-tight">BVM School</h1>
          <p className="text-gray-500 text-sm mt-1">Student Portal — Sign In</p>
        </div>

        {/* Card */}
        <div className="w-full max-w-sm bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white p-6">

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Username */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Username / Student ID</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <User className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="e.g. S0001 or your username"
                  required
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Password</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full border border-gray-200 bg-gray-50 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 flex items-center gap-2">
                <span className="text-red-500">⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white rounded-xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg disabled:opacity-60 mt-2"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><LogIn className="h-4 w-4" /> Sign In</>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-5">
            Default password: <strong className="text-gray-600">BVM123</strong> · Contact admin to reset
          </p>
        </div>
      </div>
    </div>
  );
}