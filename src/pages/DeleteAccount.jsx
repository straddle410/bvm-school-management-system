import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle, AlertTriangle, UserX, ChevronRight, ArrowLeft, Loader2, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REASONS = [
  'Transferred to another school',
  'Graduated / Passed out',
  'Personal reasons',
  'Privacy concerns',
  'No longer using the app',
  'Other',
];

const STEPS = ['Verify Identity', 'Authenticate', 'Confirm Request'];

export default function DeleteAccount() {
  const [accountType, setAccountType] = useState('student'); // 'student' | 'staff'
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundAccount, setFoundAccount] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const reset = () => {
    setStep(1);
    setUsername('');
    setPassword('');
    setReason('');
    setNotes('');
    setError('');
    setFoundAccount(null);
    setSubmitted(false);
  };

  // Step 1: Verify username exists
  const handleVerifyUsername = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (accountType === 'student') {
        const results = await base44.entities.Student.filter({ username: username.trim() });
        const student = results.find(s => !s.is_deleted);
        if (!student) { setError('No account found with this username.'); setLoading(false); return; }
        setFoundAccount({ id: student.id, name: student.name, username: student.username, student_id: student.student_id });
      } else {
        const results = await base44.entities.StaffAccount.filter({ username: username.trim() });
        const staff = results.find(s => s.is_active !== false);
        if (!staff) { setError('No active staff account found with this username.'); setLoading(false); return; }
        setFoundAccount({ id: staff.id, name: staff.name, username: staff.username });
      }
      setStep(2);
    } catch (err) {
      setError('Failed to verify. Please try again.');
    }
    setLoading(false);
  };

  // Step 2: Verify password
  const handleVerifyPassword = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (accountType === 'student') {
        const res = await base44.functions.invoke('studentLogin', {
          username: username.trim(),
          password: password,
        });
        if (res.data?.error || !res.data?.student) {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }
      } else {
        const res = await base44.functions.invoke('staffLogin', {
          username: username.trim(),
          password: password,
        });
        if (res.data?.error || !res.data?.staff) {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }
      }
      setStep(3);
    } catch (err) {
      setError('Authentication failed. Please try again.');
    }
    setLoading(false);
  };

  // Step 3: Submit deletion request
  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    if (!reason) { setError('Please select a reason.'); return; }
    setError('');
    setLoading(true);
    try {
      await base44.entities.DeletionRequest.create({
        account_type: accountType,
        username: foundAccount.username,
        full_name: foundAccount.name,
        reason,
        additional_notes: notes,
        status: 'Pending',
        account_id: foundAccount.id,
      });
      setSubmitted(true);
    } catch (err) {
      setError('Failed to submit request. Please try again.');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Request Submitted</h2>
          <p className="text-gray-500 text-sm mb-2">
            Your account deletion request has been submitted successfully.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            The school admin will review your request within 7 working days. You will be notified once processed.
          </p>
          <Button onClick={reset} variant="outline" className="w-full">
            Submit Another Request
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white px-4 py-5 shadow">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <UserX className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg">Delete Account</h1>
            <p className="text-xs text-blue-200">Account deletion request form</p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Warning Banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Important Notice</p>
            <p className="text-xs text-amber-700 mt-1">
              Deleting your account will remove your access to the school portal. Your academic records will be retained as required by school policy. The admin will review your request before processing.
            </p>
          </div>
        </div>

        {/* Account Type Selector — only on step 1 */}
        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Account Type</p>
            <div className="grid grid-cols-2 gap-2">
              {['student', 'staff'].map(type => (
                <button
                  key={type}
                  onClick={() => { setAccountType(type); setError(''); }}
                  className={`py-3 rounded-xl border-2 text-sm font-semibold capitalize transition-all ${
                    accountType === type
                      ? 'border-[#1a237e] bg-[#e8eaf6] text-[#1a237e]'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center gap-2">
          {STEPS.map((label, idx) => {
            const stepNum = idx + 1;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <React.Fragment key={label}>
                <div className="flex items-center gap-1.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isDone ? 'bg-green-500 text-white' :
                    isActive ? 'bg-[#1a237e] text-white' :
                    'bg-gray-200 text-gray-500'
                  }`}>
                    {isDone ? '✓' : stepNum}
                  </div>
                  <span className={`text-xs font-medium hidden sm:block ${isActive ? 'text-[#1a237e]' : 'text-gray-400'}`}>
                    {label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && <div className="flex-1 h-px bg-gray-200" />}
              </React.Fragment>
            );
          })}
        </div>

        {/* Step 1: Username */}
        {step === 1 && (
          <form onSubmit={handleVerifyUsername} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div>
              <p className="font-semibold text-gray-800 mb-1">Step 1: Enter your username</p>
              <p className="text-xs text-gray-400">Enter the username you use to log in to the school portal.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Username</label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                required
                placeholder={accountType === 'student' ? 'e.g. S25001' : 'e.g. T101'}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" disabled={loading || !username.trim()} className="w-full bg-[#1a237e] hover:bg-[#283593]">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {loading ? 'Verifying...' : 'Continue'} <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </form>
        )}

        {/* Step 2: Password */}
        {step === 2 && foundAccount && (
          <form onSubmit={handleVerifyPassword} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div>
              <p className="font-semibold text-gray-800 mb-1">Step 2: Verify your identity</p>
              <p className="text-xs text-gray-400">Enter your password to confirm it's you.</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-xs text-blue-700">Account found: <strong>{foundAccount.name}</strong> (@{foundAccount.username})</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                required
                placeholder="Enter your password"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
              />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setStep(1); setError(''); setPassword(''); }} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button type="submit" disabled={loading || !password} className="flex-1 bg-[#1a237e] hover:bg-[#283593]">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {loading ? 'Verifying...' : 'Verify'} <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </form>
        )}

        {/* Step 3: Reason & Submit */}
        {step === 3 && (
          <form onSubmit={handleSubmitRequest} className="bg-white rounded-xl shadow-sm p-5 space-y-4">
            <div>
              <p className="font-semibold text-gray-800 mb-1">Step 3: Reason for deletion</p>
              <p className="text-xs text-gray-400">Please tell us why you want to delete your account.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">Reason *</label>
              <div className="space-y-2">
                {REASONS.map(r => (
                  <label key={r} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    reason === r ? 'border-[#1a237e] bg-[#e8eaf6]' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                    <input
                      type="radio"
                      name="reason"
                      value={r}
                      checked={reason === r}
                      onChange={() => setReason(r)}
                      className="accent-[#1a237e]"
                    />
                    <span className="text-sm text-gray-800">{r}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Additional notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional information..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50 resize-none"
              />
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs text-red-700">
                <strong>Note:</strong> This is a deletion <em>request</em>. The school admin will review and process it within 7 working days.
              </p>
            </div>

            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => { setStep(2); setError(''); }} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button type="submit" disabled={loading || !reason} className="flex-1 bg-red-600 hover:bg-red-700">
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserX className="h-4 w-4 mr-1" />}
                {loading ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        )}

        <p className="text-center text-xs text-gray-400 pb-4 flex items-center justify-center gap-1">
          <Shield className="h-3 w-3" /> Your data is protected under our Privacy Policy
        </p>
      </div>
    </div>
  );
}