import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function StudentChangePassword({ student, onClose, onSuccess }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Fetch latest student data to verify current password
    setLoading(true);
    try {
      const results = await base44.entities.Student.filter({ username: student.username });
      if (!results || results.length === 0) {
        setError('Student not found.');
        setLoading(false);
        return;
      }
      const studentData = results[0];
      const storedPassword = studentData.password || 'BVM123';

      if (currentPassword !== storedPassword) {
        setError('Current password is incorrect.');
        setLoading(false);
        return;
      }
      if (newPassword.length < 4) {
        setError('New password must be at least 4 characters.');
        setLoading(false);
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }

      await base44.entities.Student.update(studentData.id, { password: newPassword });
      toast.success('Password changed successfully!');
      onSuccess();
    } catch (err) {
      setError('Failed to change password. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Lock className="h-5 w-5 text-[#1a237e]" /> Change Password
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Current Password</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
              />
              <button type="button" onClick={() => setShowCurrent(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">New Password</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                placeholder="Enter new password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
              />
              <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
              placeholder="Re-enter new password"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="w-full bg-[#1a237e] hover:bg-[#283593]">
            {loading ? 'Saving...' : 'Change Password'}
          </Button>
        </form>
      </div>
    </div>
  );
}