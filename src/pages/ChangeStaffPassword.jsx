import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { validatePasswordPolicy } from '@/components/utils/passwordPolicy';
import { toast } from 'sonner';

const ERROR_MESSAGES = {
  CURRENT_PASSWORD_INCORRECT: 'The current password you entered is incorrect.',
  STAFF_SESSION_INVALID: 'Your session has expired. Please log in again.',
  TOKEN_MISSING: 'Your session has expired. Please log in again.',
  WEAK_PASSWORD: 'Password must be at least 8 characters.',
  MISSING_FIELDS: 'Please fill in all fields.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
};

export default function ChangeStaffPassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [success, setSuccess] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    // Resolve staff_session_token from localStorage
    try {
      const raw = localStorage.getItem('staff_session');
      if (!raw) { navigate(createPageUrl('StaffLogin')); return; }
      const session = JSON.parse(raw);
      const t = session?.staff_session_token;
      if (!t) { navigate(createPageUrl('StaffLogin')); return; }
      setToken(t);
    } catch {
      navigate(createPageUrl('StaffLogin'));
    }
  }, []);

  const handleChange = async (e) => {
    e.preventDefault();
    setError('');
    setErrorCode('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (newPassword.length < 8) {
      setError(ERROR_MESSAGES.WEAK_PASSWORD);
      setErrorCode('WEAK_PASSWORD');
      return;
    }

    if (!token) {
      setError(ERROR_MESSAGES.TOKEN_MISSING);
      setErrorCode('TOKEN_MISSING');
      return;
    }

    setLoading(true);

    try {
      // Send token both in body (fallback) and via staff_session_token field
      // The backend reads it from body.staff_session_token
      const response = await base44.functions.invoke('changeStaffPassword', {
        currentPassword,
        newPassword,
        staff_session_token: token,
      });

      if (response.data?.success) {
        // Update local session to reflect force_password_change=false
        try {
          const raw = localStorage.getItem('staff_session');
          if (raw) {
            const session = JSON.parse(raw);
            session.force_password_change = false;
            localStorage.setItem('staff_session', JSON.stringify(session));
          }
        } catch {}

        setSuccess(true);
        toast.success('Password changed successfully!');
        setTimeout(() => navigate(createPageUrl('Dashboard')), 2000);
      }
    } catch (err) {
      const code = err.response?.data?.code || 'UNKNOWN_ERROR';
      const msg = ERROR_MESSAGES[code] || err.response?.data?.error || ERROR_MESSAGES.UNKNOWN_ERROR;
      setError(msg);
      setErrorCode(code);

      // If session invalid → force re-login
      if (code === 'STAFF_SESSION_INVALID' || code === 'TOKEN_MISSING') {
        localStorage.removeItem('staff_session');
        setTimeout(() => navigate(createPageUrl('StaffLogin')), 2500);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-[#1a237e] to-[#283593] text-white rounded-t-lg pb-6">
          <Lock className="h-10 w-10 mx-auto mb-3" />
          <CardTitle className="text-center text-2xl">Change Password</CardTitle>
          <CardDescription className="text-center text-blue-100 mt-1">
            First login — password change required
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8">
          {success ? (
            <div className="space-y-4 text-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-lg font-semibold text-slate-800">Password Changed!</h3>
              <p className="text-sm text-slate-600">Redirecting to dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleChange} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-700">{error}</p>
                    {errorCode && (
                      <p className="text-xs text-red-400 font-mono mt-0.5">{errorCode}</p>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current (temporary) password"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  disabled={loading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  disabled={loading}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading || !token}
                className="w-full h-10 bg-gradient-to-r from-[#1a237e] to-[#283593] hover:from-[#0d1b5e] hover:to-[#1a2673] text-white font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Changing...
                  </>
                ) : (
                  'Change Password'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}