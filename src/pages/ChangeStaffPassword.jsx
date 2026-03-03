import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Lock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ChangeStaffPassword() {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const session = (() => {
    try {
      return JSON.parse(localStorage.getItem('staff_session') || '{}');
    } catch {
      navigate('/staff-login');
      return {};
    }
  })();

  const handleChange = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await base44.functions.invoke('changeStaffPassword', {
        staff_id: session.staff_id,
        current_password: currentPassword,
        new_password: newPassword,
      });

      if (response.data.success) {
        setSuccess(true);
        toast.success('Password changed successfully');
        setTimeout(() => navigate('/staff-dashboard'), 2000);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Password change failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="bg-gradient-to-r from-[#1a237e] to-[#283593] text-white rounded-t-lg">
          <Lock className="h-10 w-10 mx-auto mb-3" />
          <CardTitle className="text-center text-2xl">Change Password</CardTitle>
          <CardDescription className="text-center text-blue-100 mt-1">
            First login - password change required
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-8">
          {success ? (
            <div className="space-y-4 text-center py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-lg font-semibold text-slate-800">Success!</h3>
              <p className="text-sm text-slate-600">
                Your password has been changed. Redirecting to dashboard...
              </p>
            </div>
          ) : (
            <form onSubmit={handleChange} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-slate-700 font-medium">Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
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
                <Label className="text-slate-700 font-medium">Confirm Password</Label>
                <Input
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