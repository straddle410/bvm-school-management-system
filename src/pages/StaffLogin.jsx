import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Building2, Lock, User, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function StaffLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedUntil, setLockedUntil] = useState(null);

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
        if (response.data.locked_until) {
          setLockedUntil(response.data.locked_until);
        }
        setError(response.data.error || 'Login failed');
        return;
      }

      // Store session
      const session = {
        staff_id: response.data.staff_id,
        username: response.data.username,
        name: response.data.name,
        role_template_id: response.data.role_template_id,
        permissions: response.data.permissions,
        permissions_override: response.data.permissions_override,
        logged_in_at: new Date().toISOString(),
      };

      localStorage.setItem('staff_session', JSON.stringify(session));

      // If password change required, redirect to change password
      if (response.data.force_password_change) {
        navigate('/change-password');
        return;
      }

      toast.success('Login successful');
      navigate('/staff-dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
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