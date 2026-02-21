import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, LogIn, GraduationCap, ArrowLeft } from 'lucide-react';
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
      // Search by username
      const results = await base44.entities.Student.filter({ username: username.trim() });

      if (!results || results.length === 0) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      const student = results[0];
      const storedPassword = student.password || 'BVM123';

      if (password !== storedPassword) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      // Save student session
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
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] to-[#283593] flex flex-col items-center justify-center px-4 relative">
      <Link
        to={createPageUrl('Dashboard')}
        className="absolute top-6 left-6 text-white hover:text-blue-200 transition-colors z-50 p-2"
      >
        <ArrowLeft className="h-7 w-7" />
      </Link>

      <div className="flex flex-col items-center mb-8">
        <div className="h-16 w-16 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg">
          <GraduationCap className="h-9 w-9 text-[#1a237e]" />
        </div>
        <h1 className="text-white text-2xl font-bold tracking-tight">BVM School of Excellence</h1>
        <p className="text-blue-200 text-sm mt-1">Student Portal</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-1">Student Login</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your username and password</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="e.g. S0001 or your username"
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
          Default password is <strong>BVM123</strong>. Contact admin to reset.
        </p>
      </div>
    </div>
  );
}