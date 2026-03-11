import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Building2, Lock, User, AlertTriangle, Loader2, ShieldAlert, LogOut, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState(null);
  const [linkConflict, setLinkConflict] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await base44.functions.invoke('staffLogin', {
        username,
        password,
      });

      if (!response.data.success) {
        if (response.data.code === 'LINK_CONFLICT') {
          setLinkConflict(true);
          return;
        }
        if (response.data.locked_until || response.data.code === 'ACCOUNT_LOCKED') {
          setLockedUntil(response.data.locked_until);
        }
        const code = response.data.code;
        const codeMessages = {
          USER_NOT_FOUND: 'Username not found. Please check and try again.',
          PASSWORD_MISMATCH: 'Incorrect password. Please try again.',
          ACCOUNT_INACTIVE: 'Your account is inactive. Contact your administrator.',
          ACCOUNT_LOCKED: 'Account locked due to too many attempts. Try again in 15 minutes.',
          PASSWORD_NOT_SET: 'Password not set. Ask your administrator to reset your password.',
        };
        setError(codeMessages[code] || response.data.error || 'Login failed');
        return;
      }

      // Always clear any student session — staff must never fall into student flow
      const { saveSession, clearSession } = await import('@/components/sessionHelper');
      clearSession('student_session');

      // Store staff session with long-lived signed token (60 days)
      const session = {
        staff_id: response.data.staff_id,
        username: response.data.username,
        name: response.data.name,
        full_name: response.data.full_name,
        role: response.data.role,
        designation: response.data.designation,
        role_template_id: response.data.role_template_id,
        permissions: response.data.permissions || {},
        effective_permissions: response.data.effective_permissions || {},
        permissions_override: response.data.permissions_override || {},
        logged_in_at: new Date().toISOString(),
        // Long-lived signed session token — primary identity proof for all staff API calls
        staff_session_token: response.data.staff_session_token,
        token_exp: response.data.token_exp,
      };

      saveSession('staff_session', session);

      // Debug: decode token claims to confirm structure
      try {
        const tokenParts = response.data.staff_session_token.split('.');
        const claims = JSON.parse(atob(tokenParts[0].replace(/-/g, '+').replace(/_/g, '/') + '=='));
        console.log('[StaffLogin] Token claims:', { staff_id: claims.staff_id, username: claims.username, role: claims.role, iat: claims.iat, exp: claims.exp });
      } catch {}
      console.log(`[StaffLogin] Session saved: role=${response.data.role} staff_id=${response.data.staff_id} username=${response.data.username} token_exp=${response.data.token_exp_iso}`);

      // If password change required, redirect to change password
      if (response.data.force_password_change) {
        toast.success('Login successful. Please change your password.');
        navigate(createPageUrl('ChangeStaffPassword'));
        return;
      }

      toast.success('Login successful');
      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // LINK_CONFLICT full-screen view
  if (linkConflict) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0">
          <CardHeader className="bg-red-600 text-white rounded-t-lg">
            <div className="flex items-center justify-center mb-3">
              <ShieldAlert className="h-10 w-10" />
            </div>
            <CardTitle className="text-center text-xl">Session Conflict</CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <p className="text-gray-800 font-medium">
              This browser session is already linked to a <strong>different staff account</strong>.
            </p>
            <p className="text-sm text-gray-600">
              This can happen when two staff members share the same device or browser profile.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 space-y-1">
              <p className="font-semibold">What to do:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Use a <strong>different browser</strong> or an incognito / private window.</li>
                <li>Or ask your <strong>administrator</strong> to reset your session link.</li>
              </ul>
            </div>
            <Button
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={() => {
                localStorage.removeItem('staff_session');
                base44.auth.logout();
              }}
            >
              <LogOut className="h-4 w-4" />
              Log out &amp; start fresh
            </Button>
            <button
              className="w-full text-xs text-gray-400 hover:text-gray-600 text-center"
              onClick={() => setLinkConflict(false)}
            >
              ← Back to login
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
      {/* Back button */}
      <button
        onClick={() => navigate(createPageUrl('Home'))}
        className="absolute top-4 left-4 flex items-center gap-1 text-white/80 hover:text-white text-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Locked Account Dialog */}
      <AlertDialog open={!!lockedUntil} onOpenChange={() => setLockedUntil(null)}>
        <AlertDialogContent>
          <AlertDialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Account Locked
          </AlertDialogTitle>
          <AlertDialogDescription>
            Your account has been locked due to too many failed login attempts. Please try again after the lockout period expires.
          </AlertDialogDescription>
          <div className="p-3 bg-red-50 rounded-lg mt-2">
            <p className="text-sm font-mono text-red-700">
              Locked until: {new Date(lockedUntil).toLocaleTimeString()}
            </p>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <AlertDialogAction onClick={() => setLockedUntil(null)}>
              OK
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-[#1a237e] to-[#283593] text-white rounded-t-lg">
          <div className="flex items-center justify-center mb-3">
            <Building2 className="h-10 w-10" />
          </div>
          <CardTitle className="text-center text-2xl">Staff Login</CardTitle>
          <CardDescription className="text-center text-blue-100 mt-1">
            BVM School Management System
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8">
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="username" className="text-slate-700 font-medium">
                <User className="inline h-4 w-4 mr-1" />
                Username
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g., ravi.kumar01"
                className="border-slate-300"
                disabled={loading}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 font-medium">
                <Lock className="inline h-4 w-4 mr-1" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="border-slate-300"
                disabled={loading}
                required
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 bg-gradient-to-r from-[#1a237e] to-[#283593] hover:from-[#0d1b5e] hover:to-[#1a2673] text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>

            <p className="text-center text-xs text-slate-500 mt-6">
              For account issues, contact your administrator.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}