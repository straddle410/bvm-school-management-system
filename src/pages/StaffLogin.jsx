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
import { Link } from 'react-router-dom';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [staffId, setStaffId] = useState('');
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
      // Step 1: Look up staff by staff_code to get their email
      console.log('[StaffLogin] Looking up Staff ID:', staffId.trim());
      
      const staffAccounts = await base44.entities.StaffAccount.filter({
        staff_code: staffId.trim()
      });

      console.log('[StaffLogin] StaffAccount lookup result:', staffAccounts);

      if (!staffAccounts || staffAccounts.length === 0) {
        console.log('[StaffLogin] Staff ID not found');
        setError('Invalid Staff ID');
        setLoading(false);
        return;
      }

      const staffAccount = staffAccounts[0];
      const email = staffAccount.email;
      
      console.log('[StaffLogin] Found StaffAccount:', {
        id: staffAccount.id,
        name: staffAccount.name,
        email: email,
        staff_code: staffAccount.staff_code
      });

      if (!email) {
        console.log('[StaffLogin] No email found for staff account');
        setError('Staff account email not configured. Contact administrator.');
        setLoading(false);
        return;
      }

      console.log('[StaffLogin] Attempting login with email:', email);

      // Step 2: Login using Base44 auth with email and password
      await base44.auth.loginViaEmailPassword(email, password);

      console.log('[StaffLogin] Login successful');

      // Always clear any student session — staff must never fall into student flow
      const { saveSession, clearSession } = await import('@/components/sessionHelper');
      clearSession('student_session');

      // Store staff session with staff-specific data
      const session = {
        staff_id: staffAccount.id,
        username: staffAccount.username,
        name: staffAccount.name,
        full_name: staffAccount.name,
        role: staffAccount.role,
        designation: staffAccount.designation,
        role_template_id: staffAccount.role_template_id,
        permissions: staffAccount.permissions || {},
        effective_permissions: staffAccount.effective_permissions || {},
        permissions_override: staffAccount.permissions_override || {},
        logged_in_at: new Date().toISOString(),
        staff_code: staffAccount.staff_code,
        email: email,
      };

      saveSession('staff_session', session);

      console.log('[StaffLogin] Session saved:', {
        staff_id: staffAccount.id,
        username: staffAccount.username,
        role: staffAccount.role,
        staff_code: staffAccount.staff_code
      });

      // If password change required, redirect to change password
      if (staffAccount.force_password_change) {
        toast.success('Login successful. Please change your password.');
        navigate(createPageUrl('ChangeStaffPassword'));
        return;
      }

      toast.success('Login successful');
      navigate(createPageUrl('Dashboard'));
    } catch (err) {
      console.error('[StaffLogin] Login error:', err);
      
      // Check if it's an authentication error (wrong password)
      if (err.message && (err.message.includes('Invalid credentials') || err.message.includes('password') || err.message.includes('authentication'))) {
        setError('Invalid password');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
      setLoading(false);
    }
  };

  // LINK_CONFLICT full-screen view
  if (linkConflict) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-2xl border-0 dark:bg-gray-800">
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

      <Card className="w-full max-w-md shadow-2xl border-0 dark:bg-gray-800">
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
              <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="staffId" className="text-slate-700 dark:text-slate-300 font-medium">
                <User className="inline h-4 w-4 mr-1" />
                Staff ID
              </Label>
              <Input
                id="staffId"
                type="text"
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                placeholder="Enter Staff ID e.g. A101, T101"
                className="border-slate-300 dark:border-slate-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                disabled={loading}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-medium">
                <Lock className="inline h-4 w-4 mr-1" />
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="border-slate-300 dark:border-slate-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
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

            <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
              For account issues, contact your administrator.
            </p>
          </form>

          {/* Legal Links inside card */}
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-center gap-4 flex-wrap text-xs text-slate-500 dark:text-slate-400">
            <Link to={createPageUrl('HelpGuide')} className="hover:text-slate-700 dark:hover:text-slate-300 underline underline-offset-2 transition-colors">Help &amp; Guide</Link>
            <span>·</span>
            <Link to={createPageUrl('PrivacyPolicy')} className="hover:text-slate-700 dark:hover:text-slate-300 underline underline-offset-2 transition-colors">Privacy Policy</Link>
            <span>·</span>
            <Link to={createPageUrl('TermsAndConditions')} className="hover:text-slate-700 dark:hover:text-slate-300 underline underline-offset-2 transition-colors">Terms &amp; Conditions</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}