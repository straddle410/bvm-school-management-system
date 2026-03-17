import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertCircle, Lock, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AccountDeletionModal({ isOpen, onClose, userType, userId, userName, onSuccess }) {
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [isUnderstood, setIsUnderstood] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordSubmit = () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleConfirm = async () => {
    if (!isUnderstood) {
      setError('Please acknowledge the warning');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await base44.functions.invoke('deleteUserAccount', {
        userType,
        userId,
        password
      });
      setPassword('');
      setIsUnderstood(false);
      setStep(1);
      onClose();
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to delete account. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setPassword('');
      setIsUnderstood(false);
      setError('');
      setStep(1);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-red-700 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Delete Account
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Password Verification */}
        {step === 1 && (
          <div className="space-y-4">
            <DialogDescription>
              Step 1 of 3: Verify your identity with your password
            </DialogDescription>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <Lock className="h-4 w-4 inline mr-2" />
              We need to verify that you own this account
            </div>
            <Input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button onClick={handlePasswordSubmit} disabled={isLoading}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Warning & Acknowledgment */}
        {step === 2 && (
          <div className="space-y-4">
            <DialogDescription>
              Step 2 of 3: Understand the consequences
            </DialogDescription>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <p className="text-sm font-semibold text-red-800">⚠️ Important Information:</p>
              <ul className="text-sm text-red-700 space-y-2 list-disc list-inside">
                <li>Your account will be permanently deleted</li>
                <li>You will lose access to all your data</li>
                <li>This action cannot be undone</li>
                <li>Historical records (marks, attendance, fees) will remain for admin purposes only</li>
              </ul>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <Checkbox
                checked={isUnderstood}
                onCheckedChange={setIsUnderstood}
                className="mt-1"
              />
              <span className="text-sm text-gray-700">
                I understand my account will be permanently deleted and this cannot be undone
              </span>
            </label>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} disabled={isLoading}>
                Back
              </Button>
              <Button 
                onClick={() => setStep(3)} 
                disabled={!isUnderstood || isLoading}
                className="flex-1"
              >
                I Understand, Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Final Confirmation */}
        {step === 3 && (
          <div className="space-y-4">
            <DialogDescription>
              Step 3 of 3: Final confirmation
            </DialogDescription>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-yellow-800 mb-2">Last chance to cancel</p>
              <p className="text-sm text-yellow-700">
                You are about to delete the account for <strong>{userName}</strong>. This is your final confirmation.
              </p>
            </div>
            <Button 
              variant="destructive" 
              onClick={handleConfirm} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? 'Deleting...' : 'Yes, Delete My Account Permanently'}
            </Button>
            <Button variant="outline" onClick={() => setStep(2)} disabled={isLoading} className="w-full">
              Cancel & Go Back
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}