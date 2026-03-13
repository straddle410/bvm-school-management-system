import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Phone, User, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1 - Identity Verification
  const [staffId, setStaffId] = useState('');
  const [mobile, setMobile] = useState('');
  const [staffRecord, setStaffRecord] = useState(null);
  
  // Step 2 - OTP Verification
  const [otp, setOtp] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  
  // Step 3 - Reset Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Resend timer countdown
  useEffect(() => {
    if (step === 2 && !canResend && resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    } else if (resendTimer === 0) {
      setCanResend(true);
    }
  }, [step, resendTimer, canResend]);

  const handleSendOTP = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Find staff by staff_code and mobile
      const staffRecords = await base44.entities.StaffAccount.filter({
        staff_code: staffId.trim(),
        mobile: mobile.trim()
      });

      if (!staffRecords || staffRecords.length === 0) {
        toast.error('Staff ID or Mobile number not matching');
        setLoading(false);
        return;
      }

      const staff = staffRecords[0];
      setStaffRecord(staff);

      // Send OTP
      const response = await base44.functions.invoke('sendStaffOtp', {
        staff_code: staffId.trim(),
        mobile: mobile.trim()
      });

      if (response.data.success) {
        toast.success('OTP sent to your registered mobile number');
        setStep(2);
        setResendTimer(30);
        setCanResend(false);
      } else {
        toast.error(response.data.error || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('Send OTP error:', err);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setLoading(true);
    try {
      const response = await base44.functions.invoke('sendStaffOtp', {
        staff_code: staffId.trim(),
        mobile: mobile.trim()
      });

      if (response.data.success) {
        toast.success('OTP resent successfully');
        setResendTimer(30);
        setCanResend(false);
        setOtp('');
      } else {
        toast.error(response.data.error || 'Failed to resend OTP');
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      toast.error('Failed to resend OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Get latest staff record to check OTP
      const staff = await base44.entities.StaffAccount.get(staffRecord.id);

      if (!staff.reset_otp || !staff.reset_otp_expiry) {
        toast.error('OTP expired. Please request a new one.');
        setStep(1);
        setLoading(false);
        return;
      }

      // Check expiry
      const expiryTime = new Date(staff.reset_otp_expiry);
      if (new Date() > expiryTime) {
        toast.error('OTP expired. Please request a new one.');
        setStep(1);
        setLoading(false);
        return;
      }

      // Verify OTP
      if (staff.reset_otp !== otp.trim()) {
        toast.error('Invalid OTP. Please try again.');
        setLoading(false);
        return;
      }

      toast.success('OTP verified successfully');
      setStep(3);
    } catch (err) {
      console.error('Verify OTP error:', err);
      toast.error('Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

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
      const response = await base44.functions.invoke('resetStaffPassword', {
        staff_code: staffId,
        otp: otp,
        new_password: newPassword
      });

      if (response.data.success) {
        toast.success('Password reset successfully! Please login.');
        setTimeout(() => navigate('/StaffLogin'), 2000);
      } else {
        toast.error(response.data.error || 'Failed to reset password');
        setLoading(false);
      }
    } catch (err) {
      console.error('Reset password error:', err);
      toast.error('Failed to reset password');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
      <button
        onClick={() => navigate('/StaffLogin')}
        className="absolute top-4 left-4 flex items-center gap-1 text-white/80 hover:text-white text-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Login
      </button>

      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-[#1a237e] to-[#283593] text-white rounded-t-lg">
          <CardTitle className="text-center text-2xl">Forgot Password</CardTitle>
          <CardDescription className="text-center text-blue-100 mt-1">
            Reset your staff account password
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8">
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-8">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                  s === step ? 'bg-blue-600 text-white' : 
                  s < step ? 'bg-green-600 text-white' : 
                  'bg-gray-200 text-gray-500'
                }`}>
                  {s < step ? <CheckCircle2 className="h-5 w-5" /> : s}
                </div>
                {s < 3 && <div className={`w-16 h-1 mx-2 ${s < step ? 'bg-green-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* STEP 1 - Verify Identity */}
          {step === 1 && (
            <form onSubmit={handleSendOTP} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="staffId">
                  <User className="inline h-4 w-4 mr-1" />
                  Staff ID
                </Label>
                <Input
                  id="staffId"
                  type="text"
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  placeholder="Enter your Staff ID"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="mobile">
                  <Phone className="inline h-4 w-4 mr-1" />
                  Registered Mobile Number
                </Label>
                <Input
                  id="mobile"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="Enter registered mobile number"
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#1a237e] to-[#283593]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending OTP...
                  </>
                ) : (
                  'Send OTP'
                )}
              </Button>
            </form>
          )}

          {/* STEP 2 - Enter OTP */}
          {step === 2 && (
            <form onSubmit={handleVerifyOTP} className="space-y-4">
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 text-center">
                OTP sent to your registered mobile number
              </div>

              <div className="space-y-2">
                <Label htmlFor="otp">Enter 6-digit OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-gradient-to-r from-[#1a237e] to-[#283593]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify OTP'
                )}
              </Button>

              <div className="text-center">
                {canResend ? (
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    disabled={loading}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Resend OTP
                  </button>
                ) : (
                  <p className="text-sm text-gray-500">
                    Resend OTP in {resendTimer}s
                  </p>
                )}
              </div>
            </form>
          )}

          {/* STEP 3 - Reset Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  <Lock className="inline h-4 w-4 mr-1" />
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  <Lock className="inline h-4 w-4 mr-1" />
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#1a237e] to-[#283593]"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Resetting Password...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}