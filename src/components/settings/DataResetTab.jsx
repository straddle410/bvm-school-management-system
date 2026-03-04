import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, ShieldAlert, RotateCcw, ChevronRight, Download, CheckCircle2, XCircle, Loader2, Mail, Lock } from 'lucide-react';
import { toast } from "sonner";

const MODULES = [
  { id: 'fees',           label: 'Fees module data',              risk: 'high',    default: true,  desc: 'Invoices, payments, plans, discounts, families' },
  { id: 'attendance',     label: 'Attendance records',            risk: 'medium',  default: false, desc: 'All daily attendance entries' },
  { id: 'marks',          label: 'Marks / Exams / Results',       risk: 'medium',  default: false, desc: 'Marks, exam types, hall tickets, progress cards' },
  { id: 'content',        label: 'Notices / Homework / Diary / Quiz', risk: 'low', default: false, desc: 'All notice, homework, diary, quiz records' },
  { id: 'staff',          label: 'Staff accounts',                risk: 'high',    default: false, desc: 'Deletes all staff except "admin"' },
  { id: 'students',       label: 'Students',                      risk: 'critical',default: false, desc: 'HIGH RISK: All student records' },
  { id: 'academic_years', label: 'Academic year data',            risk: 'critical',default: false, desc: 'HIGH RISK: All academic year configuration' },
];

const RISK_COLORS = {
  low:      'bg-blue-100 text-blue-700',
  medium:   'bg-yellow-100 text-yellow-700',
  high:     'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700',
};

const OTP_DURATION = 5 * 60; // seconds

export default function DataResetTab({ schoolProfiles = [], academicYears = [] }) {
  const profile = schoolProfiles[0];
  const isTestSchool = !!profile?.is_test_school;

  const [step, setStep] = useState(1); // 1=modules, 2=preview, 3=otp, 4=confirm, 5=done
  const [selectedModules, setSelectedModules] = useState(
    MODULES.filter(m => m.default).map(m => m.id)
  );
  const [selectedYear, setSelectedYear] = useState('');
  const [previewCounts, setPreviewCounts] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // OTP state
  const [otpRecordId, setOtpRecordId] = useState(null);
  const [otpSending, setOtpSending] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(null);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [resetToken, setResetToken] = useState(null);
  const [resetTokenExpiry, setResetTokenExpiry] = useState(null);

  // Confirmation state
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [confirmSchool, setConfirmSchool] = useState('');
  const [confirmDate, setConfirmDate] = useState('');

  // Result state
  const [resetting, setResetting] = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [backupId, setBackupId] = useState(null);

  // Audit logs
  const [auditLogs, setAuditLogs] = useState([]);

  const timerRef = useRef(null);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  useEffect(() => {
    if (otpExpiresAt) {
      const tick = () => {
        const secs = Math.max(0, Math.round((new Date(otpExpiresAt) - Date.now()) / 1000));
        setOtpSecondsLeft(secs);
        if (secs <= 0) clearInterval(timerRef.current);
      };
      tick();
      timerRef.current = setInterval(tick, 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [otpExpiresAt]);

  const loadAuditLogs = async () => {
    try {
      const logs = await base44.entities.AdminResetLog.list('-timestamp', 10);
      setAuditLogs(logs.filter(l => !l.otp_hash)); // only completed resets, not pending OTP records
    } catch {}
  };

  const toggleModule = (id) => {
    setSelectedModules(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const runDryRun = async () => {
    setPreviewLoading(true);
    try {
      const res = await base44.functions.invoke('adminResetData', {
        modules: selectedModules,
        academicYear: selectedYear || undefined,
        dryRun: true
      });
      setPreviewCounts(res.data.counts);
      setStep(2);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const sendOTP = async () => {
    setOtpSending(true);
    try {
      const res = await base44.functions.invoke('generateResetOTP', {});
      setOtpRecordId(res.data.record_id);
      setOtpExpiresAt(res.data.expires_at);
      toast.success(`OTP sent to straddle410@gmail.com`);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setOtpSending(false);
    }
  };

  const verifyOTP = async () => {
    setOtpVerifying(true);
    try {
      const res = await base44.functions.invoke('verifyResetOTP', {
        otp: otpValue,
        record_id: otpRecordId
      });
      if (res.data.success) {
        setResetToken(res.data.reset_token);
        setResetTokenExpiry(res.data.expires_at_token);
        toast.success('OTP verified! Proceed to confirm reset.');
        setStep(4);
      } else {
        toast.error(res.data.error || 'Invalid OTP');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setOtpVerifying(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const confirmationsValid =
    confirmPhrase === 'RESET SCHOOL DATA' &&
    confirmSchool === (profile?.school_name || '') &&
    confirmDate === today;

  const runReset = async () => {
    setResetting(true);
    try {
      // Step 1: Create safety backup before deletion
      setCreatingBackup(true);
      const backupRes = await base44.functions.invoke('createFeesBackup', { backupType: 'MANUAL' });
      if (!backupRes.data || backupRes.data.status !== 'COMPLETED') {
        toast.error('Safety backup failed. Reset aborted.');
        setResetting(false);
        setCreatingBackup(false);
        return;
      }
      const newBackupId = backupRes.data.id || backupRes.data.backupId;
      setBackupId(newBackupId);
      toast.success(`Safety backup created: ${newBackupId}`);
      setCreatingBackup(false);

      // Step 2: Run actual reset with backup reference
      const res = await base44.functions.invoke('adminResetData', {
        modules: selectedModules,
        academicYear: selectedYear || undefined,
        dryRun: false,
        reset_token: resetToken,
        record_id: otpRecordId,
        confirmation_phrase: confirmPhrase,
        confirmation_school_name: confirmSchool,
        confirmation_date: confirmDate,
        pre_reset_backup_id: newBackupId
      });
      setResetResult(res.data);
      setStep(5);
      await loadAuditLogs();
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setResetting(false);
    }
  };

  const downloadSummary = () => {
    const blob = new Blob([JSON.stringify(resetResult, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reset-summary-${today}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const restart = () => {
    setStep(1);
    setPreviewCounts(null);
    setOtpRecordId(null);
    setOtpValue('');
    setOtpExpiresAt(null);
    setResetToken(null);
    setConfirmPhrase('');
    setConfirmSchool('');
    setConfirmDate('');
    setResetResult(null);
    setBackupId(null);
    setSelectedModules(MODULES.filter(m => m.default).map(m => m.id));
  };

  const restoreFromBackup = async () => {
    if (!backupId) return;
    try {
      await base44.functions.invoke('restoreFeesBackup', {
        backupId,
        restoreMode: 'MERGE',
        confirmation_phrase: 'RESTORE FEES BACKUP',
        confirmation_school_name: profile?.school_name,
        confirmation_date: today
      });
      toast.success('Backup restored successfully!');
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    }
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      {/* Warning banner */}
      <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex gap-3 items-start">
        <ShieldAlert className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-red-800 text-base">⚠️ DANGEROUS: Deletes data. Use only for TEST environments.</p>
          <p className="text-sm text-red-700 mt-1">This tool permanently deletes selected data. It cannot be undone. Ensure this is a test school before proceeding.</p>
        </div>
      </div>

      {/* Test school guard */}
      {!isTestSchool && (
        <Card className="border-2 border-orange-300 bg-orange-50">
          <CardContent className="pt-6 flex gap-3 items-center">
            <Lock className="h-6 w-6 text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-orange-800">Reset disabled for production schools.</p>
              <p className="text-sm text-orange-700 mt-1">
                To enable the Data Reset tool, go to <strong>School Profile</strong> and enable <strong>"is_test_school"</strong> flag. This prevents accidental production data loss.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step indicator */}
      {isTestSchool && (
        <div className="flex items-center gap-1 flex-wrap text-xs text-slate-500">
          {['Modules', 'Preview', 'OTP', 'Confirm', 'Done'].map((s, i) => (
            <React.Fragment key={s}>
              <span className={`px-2 py-1 rounded ${step === i + 1 ? 'bg-red-600 text-white font-semibold' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100'}`}>
                Step {i + 1}: {s}
              </span>
              {i < 4 && <ChevronRight className="h-3 w-3" />}
            </React.Fragment>
          ))}
        </div>
      )}

      {/* STEP 1: Module Selection */}
      {isTestSchool && step === 1 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2"><RotateCcw className="h-5 w-5" /> Step 1: Select Modules to Reset</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {MODULES.map(m => (
                <div key={m.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white hover:bg-slate-50">
                  <Checkbox
                    id={m.id}
                    checked={selectedModules.includes(m.id)}
                    onCheckedChange={() => toggleModule(m.id)}
                    className="mt-0.5"
                  />
                  <label htmlFor={m.id} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-800">{m.label}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${RISK_COLORS[m.risk]}`}>{m.risk}</span>
                      {m.default && <span className="text-xs text-slate-400">(default)</span>}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{m.desc}</p>
                  </label>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Label>Academic Year Filter (optional)</Label>
              <p className="text-xs text-slate-500 mb-2">If selected, only records linked to this year will be deleted (where supported)</p>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="max-w-xs">
                  <SelectValue placeholder="All years (no filter)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All years (no filter)</SelectItem>
                  {academicYears.map(y => (
                    <SelectItem key={y.id} value={y.year}>{y.year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={runDryRun}
              disabled={selectedModules.length === 0 || previewLoading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {previewLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Calculating...</> : 'Preview Deletion Counts →'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Preview counts */}
      {isTestSchool && step === 2 && previewCounts && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-orange-700 flex items-center gap-2"><AlertTriangle className="h-5 w-5" /> Step 2: Deletion Preview</CardTitle>
            <CardDescription>No data has been deleted yet. Review carefully.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedYear && <div className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded">Academic Year Filter: <strong>{selectedYear}</strong></div>}
            <div className="overflow-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600">Entity</th>
                    <th className="text-right px-4 py-2 text-slate-600">Records to Delete</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(previewCounts).map(([entity, count]) => (
                    <tr key={entity} className="border-t">
                      <td className="px-4 py-2 font-mono text-slate-700">{entity}</td>
                      <td className={`px-4 py-2 text-right font-semibold ${count > 0 ? 'text-red-600' : 'text-slate-400'}`}>{count}</td>
                    </tr>
                  ))}
                  <tr className="border-t bg-red-50">
                    <td className="px-4 py-2 font-bold text-red-800">TOTAL</td>
                    <td className="px-4 py-2 text-right font-bold text-red-800">
                      {Object.values(previewCounts).reduce((a, b) => a + b, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => { setStep(3); sendOTP(); }} className="bg-red-600 hover:bg-red-700 text-white">
                <Mail className="mr-2 h-4 w-4" /> Proceed — Send OTP →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: OTP */}
      {isTestSchool && step === 3 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-blue-700 flex items-center gap-2"><Mail className="h-5 w-5" /> Step 3: OTP Verification</CardTitle>
            <CardDescription>A 6-digit OTP will be sent to straddle410@gmail.com. Valid for 5 minutes.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-sm">
            {!otpRecordId ? (
              <Button onClick={sendOTP} disabled={otpSending} className="bg-blue-600 hover:bg-blue-700 text-white">
                {otpSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending...</> : <><Mail className="mr-2 h-4 w-4" /> Send OTP</>}
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 px-3 py-2 rounded">
                  <CheckCircle2 className="h-4 w-4" />
                  OTP sent to straddle410@gmail.com
                  {otpSecondsLeft > 0 && <span className="ml-auto font-mono font-bold">{formatTime(otpSecondsLeft)}</span>}
                </div>
                {otpSecondsLeft === 0 && (
                  <div className="text-xs text-red-600">OTP expired. <button className="underline" onClick={sendOTP}>Send new OTP</button></div>
                )}
                <div>
                  <Label>Enter 6-digit OTP</Label>
                  <Input
                    value={otpValue}
                    onChange={e => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    className="font-mono text-xl tracking-widest mt-1"
                  />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(2)}>← Back</Button>
                  <Button
                    onClick={verifyOTP}
                    disabled={otpValue.length !== 6 || otpVerifying || otpSecondsLeft === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {otpVerifying ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : 'Verify OTP →'}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 4: Confirmation with Backup Progress */}
      {isTestSchool && step === 4 && (
        <Card className="border-2 border-red-300">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Step 4: Final Confirmation</CardTitle>
            <CardDescription>Type each value exactly to unlock the reset button. A safety backup will be created before deletion.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 max-w-md">
            <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-sm text-green-800 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" /> OTP verified successfully
            </div>

            <div>
              <Label>Type exactly: <code className="bg-slate-100 px-2 py-0.5 rounded text-red-700">RESET SCHOOL DATA</code></Label>
              <Input value={confirmPhrase} onChange={e => setConfirmPhrase(e.target.value)} className="mt-1 font-mono" placeholder="RESET SCHOOL DATA" />
              {confirmPhrase && confirmPhrase !== 'RESET SCHOOL DATA' && <p className="text-xs text-red-500 mt-1">Does not match</p>}
            </div>

            <div>
              <Label>Type your school name exactly: <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{profile?.school_name}</code></Label>
              <Input value={confirmSchool} onChange={e => setConfirmSchool(e.target.value)} className="mt-1" placeholder={profile?.school_name} />
              {confirmSchool && confirmSchool !== (profile?.school_name || '') && <p className="text-xs text-red-500 mt-1">Does not match</p>}
            </div>

            <div>
              <Label>Type today's date: <code className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">{today}</code></Label>
              <Input value={confirmDate} onChange={e => setConfirmDate(e.target.value)} className="mt-1 font-mono" placeholder={today} />
              {confirmDate && confirmDate !== today && <p className="text-xs text-red-500 mt-1">Does not match</p>}
            </div>

            {selectedYear && (
              <div className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded">
                Resetting year: <strong>{selectedYear}</strong>
              </div>
            )}

            {creatingBackup && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded px-3 py-2 text-sm text-blue-800">
                <Loader2 className="h-4 w-4 animate-spin" /> Creating safety backup…
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(3)} disabled={resetting}>← Back</Button>
              <Button
                onClick={runReset}
                disabled={!confirmationsValid || resetting}
                className="bg-red-700 hover:bg-red-800 text-white font-bold"
              >
                {resetting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Resetting...</> : '🗑 RESET NOW'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 5: Done */}
      {isTestSchool && step === 5 && resetResult && (
        <Card className="border-2 border-green-300 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center gap-2"><CheckCircle2 className="h-5 w-5" /> Reset Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="overflow-auto rounded-lg border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2">Entity</th>
                    <th className="text-right px-4 py-2">Deleted</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(resetResult.counts || {}).map(([entity, count]) => (
                    <tr key={entity} className="border-t">
                      <td className="px-4 py-2 font-mono">{entity}</td>
                      <td className="px-4 py-2 text-right font-semibold text-red-600">{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <Button onClick={downloadSummary} variant="outline">
                <Download className="mr-2 h-4 w-4" /> Download JSON Summary
              </Button>
              <Button onClick={restart} className="bg-slate-700 hover:bg-slate-800 text-white">
                Start New Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Logs */}
      {isTestSchool && auditLogs.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="text-slate-700 text-base">Recent Reset Audit Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {auditLogs.slice(0, 10).map(log => (
                <div key={log.id} className="flex flex-wrap items-center gap-2 text-xs bg-slate-50 rounded-lg px-3 py-2 border">
                  <span className="font-medium text-slate-700">{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="text-slate-500">by {log.admin_user_id}</span>
                  {log.is_dry_run ? <Badge variant="outline" className="text-blue-600 border-blue-300">DRY RUN</Badge>
                    : <Badge variant="outline" className="text-red-600 border-red-300">RESET</Badge>}
                  {log.academic_year_filter && <span className="text-slate-500">Year: {log.academic_year_filter}</span>}
                  {(log.actual_deleted_counts || log.dry_run_preview_counts) && (
                    <span className="text-slate-500">
                      Total: {Object.values(log.actual_deleted_counts || log.dry_run_preview_counts || {}).reduce((a, b) => a + b, 0)} records
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}