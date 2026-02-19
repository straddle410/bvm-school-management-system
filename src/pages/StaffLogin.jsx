import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Eye, EyeOff, LogIn, GraduationCap, Lock } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function StaffLogin() {
  const [step, setStep] = useState('credentials'); // 'credentials' or 'otp'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const [staffForOtp, setStaffForOtp] = useState(null);
  const [sentOtp, setSentOtp] = useState(null);

  // OTP timer effect
  useEffect(() => {
    if (otpTimer > 0) {
      const interval = setInterval(() => setOtpTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [otpTimer]);

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Find staff by username
      const staffList = await base44.entities.StaffAccount.filter({ username: username.trim() });

      if (!staffList || staffList.length === 0) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      const staff = staffList[0];

      if (staff.temp_password !== password) {
        setError('Invalid username or password');
        setLoading(false);
        return;
      }

      if (staff.is_active === false) {
        setError('Your account has been deactivated. Contact admin.');
        setLoading(false);
        return;
      }

      // Only admin requires OTP
      if (staff.role === 'Admin') {
        const response = await base44.functions.invoke('sendStaffOtp', {
          email: staff.email,
          staffName: staff.full_name
        });

        const responseData = response.data || response;
        if (!responseData.success) {
          setError('Failed to send OTP. Please try again.');
          setLoading(false);
          return;
        }

        setStaffForOtp(staff);
        setSentOtp(responseData.otp);
        setStep('otp');
        setOtpTimer(600); // 10 minutes
        setOtp('');
      } else {
        // Other staff login directly
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
      }
    } catch (err) {
      setError('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Verify OTP against sent OTP
      if (otp !== sentOtp) {
        setError('Invalid OTP. Please try again.');
        setLoading(false);
        return;
      }

      // Store staff session in localStorage
      localStorage.setItem('staff_session', JSON.stringify({
        id: staffForOtp.id,
        full_name: staffForOtp.full_name,
        username: staffForOtp.username,
        email: staffForOtp.email,
        role: staffForOtp.role,
        subjects: staffForOtp.subjects,
        classes_assigned: staffForOtp.classes_assigned,
      }));
      window.location.href = createPageUrl('Dashboard');
    } finally {
      setLoading(false);
    }
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
        {step === 'credentials' ? (
          <>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Welcome Back</h2>
            <p className="text-sm text-gray-500 mb-6">Login with your username and password</p>

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
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
          </>
        ) : (
          <>
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Lock className="h-6 w-6 text-[#1a237e]" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">Verify OTP</h2>
            <p className="text-sm text-gray-500 mb-6 text-center">Enter the OTP sent to {staffForOtp?.email}</p>

            <form onSubmit={handleOtpSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Enter OTP</label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength="6"
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || otp.length < 6}
                className="w-full bg-[#1a237e] text-white rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#283593] transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Lock className="h-5 w-5" />
                    Verify OTP
                  </>
                )}
              </button>
            </form>

            <button
              onClick={() => {
                setStep('credentials');
                setError('');
                setOtp('');
                setOtpTimer(0);
              }}
              className="w-full text-center text-sm text-[#1a237e] hover:underline mt-4"
            >
              Back to Login
            </button>

            <p className="text-center text-xs text-gray-400 mt-4">
              OTP expires in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}
            </p>
          </>
        )}
        </div>
        </div>
  );
}