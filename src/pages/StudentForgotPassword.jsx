import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Mail, Lock } from 'lucide-react';
import { toast } from 'sonner';

export default function StudentForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('student_id'); // 'student_id', 'otp_verify', 'reset_password'
  const [studentId, setStudentId] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!studentId.trim()) {
      toast.error('Please enter your student ID');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('studentForgotPasswordRequestOtp', { student_id: studentId.trim() });
      setStudentEmail(res.data.email);
      toast.success('OTP sent to your email');
      setStep('otp_verify');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim()) {
      toast.error('Please enter the OTP');
      return;
    }
    setLoading(true);
    try {
      await base44.functions.invoke('studentForgotPasswordVerifyOtp', {
        student_id: studentId.trim(),
        otp: otp.trim()
      });
      toast.success('OTP verified');
      setStep('reset_password');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) {
      toast.error('Please fill all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await base44.functions.invoke('studentForgotPasswordReset', {
        student_id: studentId.trim(),
        otp: otp.trim(),
        new_password: newPassword
      });
      toast.success('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/StudentLogin'), 2000);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
        {/* Header */}
        <div className="flex items-center justify-center mb-8">
          <div className="bg-[#1a237e] rounded-full p-3">
            <Building2 className="h-6 w-6 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Forgot Password?</h1>
        <p className="text-center text-gray-600 mb-8">Reset your password easily</p>

        {/* Step 1: Student ID */}
        {step === 'student_id' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Student ID</label>
              <Input
                type="text"
                placeholder="e.g., S25007"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value.toUpperCase())}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-[#1a237e] hover:bg-[#0d1860]">
              {loading ? 'Sending...' : 'Send OTP'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/StudentLogin')}
              className="w-full"
            >
              Back to Login
            </Button>
          </form>
        )}

        {/* Step 2: OTP Verification */}
        {step === 'otp_verify' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">Enter the OTP sent to <strong>{studentEmail}</strong></p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">OTP</label>
              <Input
                type="text"
                placeholder="6-digit OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                maxLength="6"
                className="w-full text-center text-2xl tracking-widest"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-[#1a237e] hover:bg-[#0d1860]">
              {loading ? 'Verifying...' : 'Verify OTP'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep('student_id')}
              className="w-full"
            >
              Back
            </Button>
          </form>
        )}

        {/* Step 3: Reset Password */}
        {step === 'reset_password' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
              <Input
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <Input
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-[#1a237e] hover:bg-[#0d1860]">
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}