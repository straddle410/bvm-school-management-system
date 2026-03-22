import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { CheckCircle, AlertTriangle, User, Shield, ChevronRight, ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const REASONS = [
  'Leaving school/institution',
  'Privacy concerns',
  'No longer using the app',
  'Transferred to another school',
  'Other',
];

export default function DeleteAccount() {
  const [accountType, setAccountType] = useState('student'); // 'student' | 'staff'
  const [step, setStep] = useState(1);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const handleStep1 = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Verify username exists
      if (accountType === 'student') {
        const results = await base44.entities.Student.filter({ username: username.trim() });
        if (!results || results.length === 0) {
          setError('No student account found with this username.');
          setLoading(false);
          return;
        }
        setVerifiedUser(results[0]);
      } else {
        const results = await base44.entities.StaffAccount.filter({ username: username.trim() });
        if (!results || results.length === 0) {
          setError('No staff account found with this username.');
          setLoading(false);
          return;
        }
        setVerifiedUser(results[0]);
      }
      setStep(2);
    } catch {
      setError('Failed to verify username. Please try again.');
    }
    setLoading(false);
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Verify password via login function
      if (accountType === 'student') {
        const res = await base44.functions.invoke('studentLogin', {
          username: username.trim(),
          password: password,
        });
        if (res.data?.error || !res.data?.success) {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }
      } else {
        const res = await base44.functions.invoke('staffLogin', {
          username: username.trim(),
          password: password,
        });
        if (res.data?.error || !res.data?.success) {
          setError('Incorrect password. Please try again.');
          setLoading(false);
          return;
        }
      }
      setStep(3);
    } catch {
      setError('Password verification failed. Please try again.');
    }
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!reason) { setError('Please select a reason.'); return; }
    setLoading(true);
    try {
      await base44.entities.DeletionRequest.create({
        account_type: accountType,
        username: username.trim(),
        display_name: verifiedUser?.name || verifiedUser?.full_name || username,
        reason,
        additional_notes: notes,
        status: 'Pending',
        requested_at: new Date().toISOString(),
        entity_db_id: verifiedUser?.id || '',
      });
      setSubmitted(true);
    } catch {
      setError('Failed to submit request. Please try again.');
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Request Submitted</h2>
          <p className="text-gray-600 text-sm mb-2">
            Your account deletion request has been received. Our admin team will review it within <strong>3–5 working days</strong>.
          </p>
          <p className="text-gray-500 text-xs mb-6">
            You will be notified once your request is processed.
          </p>
          <a
            href="/"
            className="block w-full bg-[#1a237e] text-white rounded-xl py-3 text-sm font-semibold text-center"
          >
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4ff]">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <a href="/" className="p-1 hover:bg-white/20 rounded-lg transition">
            <ArrowLeft className="h-5 w-5" />
          </a>
          <div>
            <h1 className="text-lg font-bold">Delete Account</h1>
            <p className="text-xs text-blue-100">Submit a deletion request</p>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Account Type Toggle */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-sm p-1 flex mb-6">
            <button
              onClick={() => { setAccountType('student'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${accountType === 'student' ? 'bg-[#1a237e] text-white' : 'text-gray-500'}`}
            >
              <User className="h-4 w-4" /> Student
            </button>
            <button
              onClick={() => { setAccountType('staff'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${accountType === 'staff' ? 'bg-[#1a237e] text-white' : 'text-gray-500'}`}
            >
              <Shield className="h-4 w-4" /> Staff
            </button>
          </div>
        )}

        {/* Step Indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <React.Fragment key={s}>
              <div className={`flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-colors ${step >= s ? 'bg-[#1a237e] text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-1 rounded-full transition-colors ${step > s ? 'bg-[#1a237e]' : 'bg-gray-200'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6">
          {/* Step 1 — Enter Username */}
          {step === 1 && (
            <form onSubmit={handleStep1} className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Step 1: Verify Username</h2>
                  <p className="text-xs text-gray-500">Enter your {accountType} username</p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800">
                <AlertTriangle className="h-4 w-4 inline mr-1" />
                Account deletion is <strong>permanent</strong>. All your data will be removed after admin review.
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder={accountType === 'student' ? 'e.g., S001' : 'e.g., T101'}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
                />
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="w-full bg-[#1a237e] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? 'Verifying...' : <>Continue <ChevronRight className="h-4 w-4" /></>}
              </button>
            </form>
          )}

          {/* Step 2 — Verify Password */}
          {step === 2 && (
            <form onSubmit={handleStep2} className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Step 2: Confirm Identity</h2>
                  <p className="text-xs text-gray-500">Hello, {verifiedUser?.name || username}</p>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter your password"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50"
                />
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep(1); setError(''); setPassword(''); }} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-semibold">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="flex-1 bg-[#1a237e] text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {loading ? 'Verifying...' : <>Continue <ChevronRight className="h-4 w-4" /></>}
                </button>
              </div>
            </form>
          )}

          {/* Step 3 — Select Reason & Submit */}
          {step === 3 && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <h2 className="font-bold text-gray-900">Step 3: Reason for Deletion</h2>
                  <p className="text-xs text-gray-500">Help us understand why you're leaving</p>
                </div>
              </div>

              <div className="space-y-2">
                {REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setReason(r)}
                    className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${reason === r ? 'border-[#1a237e] bg-[#e8eaf6] text-[#1a237e] font-semibold' : 'border-gray-200 text-gray-700 hover:bg-gray-50'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1.5">Additional Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional information..."
                  rows={3}
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a237e] bg-gray-50 resize-none"
                />
              </div>

              {error && <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-800">
                By submitting, you confirm that you want your <strong>{accountType}</strong> account (<strong>{username}</strong>) to be permanently deleted.
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => { setStep(2); setError(''); }} className="flex-1 border border-gray-200 text-gray-600 rounded-xl py-3 text-sm font-semibold">
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !reason}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-xl py-3 text-sm font-semibold disabled:opacity-60"
                >
                  {loading ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Your request will be reviewed by the school admin within 3–5 working days.
        </p>
      </div>
    </div>
  );
}