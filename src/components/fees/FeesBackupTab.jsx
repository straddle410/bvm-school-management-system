import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import {
  Download, Upload, RefreshCw, HardDrive, CheckCircle2, XCircle,
  AlertTriangle, Cloud, ShieldCheck, Database, Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DRIVE_EXPORT_STATUS = {
  NOT_EXPORTED: { label: 'Not Exported', color: 'bg-slate-100 text-slate-600' },
  EXPORTED: { label: 'Drive ✓', color: 'bg-green-100 text-green-700' },
  FAILED: { label: 'Drive Failed', color: 'bg-red-100 text-red-700' },
};

function BackupStatusBadge({ status }) {
  const colors = { COMPLETED: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-700', CREATED: 'bg-yellow-100 text-yellow-700' };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[status] || 'bg-slate-100 text-slate-600'}`}>{status}</span>;
}

function DriveStatusBadge({ status }) {
  const cfg = DRIVE_EXPORT_STATUS[status] || DRIVE_EXPORT_STATUS.NOT_EXPORTED;
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>{cfg.label}</span>;
}

export default function FeesBackupTab({ isAdmin, schoolProfile }) {
  const qc = useQueryClient();
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [restoreMode, setRestoreMode] = useState('MERGE');
  const [restorePhrase, setRestorePhrase] = useState('');
  const [restoreSchool, setRestoreSchool] = useState('');
  const [restoreDate, setRestoreDate] = useState('');
  const [restoreResult, setRestoreResult] = useState(null);
  const [autoExportEnabled, setAutoExportEnabled] = useState(!!schoolProfile?.backup_auto_drive_export);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    setAutoExportEnabled(!!schoolProfile?.backup_auto_drive_export);
  }, [schoolProfile]);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['fees-backups'],
    queryFn: () => base44.entities.FeesBackup.list('-created_date', 50),
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: () => base44.functions.invoke('createFeesBackup', { backupType: 'MANUAL' }),
    onSuccess: (res) => {
      qc.invalidateQueries(['fees-backups']);
      toast.success(`Backup created! ${res.data?.totalRecords || 0} records saved.`);
    },
    onError: (err) => toast.error(`Backup failed: ${err.message}`)
  });

  const exportDriveMutation = useMutation({
    mutationFn: (backupId) => base44.functions.invoke('exportFeesBackupToDrive', { backupId }),
    onSuccess: () => {
      qc.invalidateQueries(['fees-backups']);
      toast.success('Exported to Google Drive!');
    },
    onError: (err) => toast.error(`Drive export failed: ${err.message}`)
  });

  const restoreMutation = useMutation({
    mutationFn: () => base44.functions.invoke('restoreFeesBackup', {
      backupId: restoreTarget?.id,
      restoreMode,
      confirmation_phrase: restorePhrase,
      confirmation_school_name: restoreSchool,
      confirmation_date: restoreDate,
    }),
    onSuccess: (res) => {
      setRestoreResult(res.data);
      qc.invalidateQueries(['fees-backups']);
      toast.success(`Restore complete! ${res.data?.totalRestored || 0} records restored.`);
    },
    onError: (err) => toast.error(`Restore failed: ${err.message}`)
  });

  const toggleAutoExportMutation = useMutation({
    mutationFn: async (val) => {
      if (!schoolProfile?.id) return;
      await base44.entities.SchoolProfile.update(schoolProfile.id, { backup_auto_drive_export: val });
      return val;
    },
    onSuccess: (val) => {
      setAutoExportEnabled(val);
      qc.invalidateQueries(['school-profile']);
      toast.success(val ? 'Auto Drive export enabled' : 'Auto Drive export disabled');
    }
  });

  const handleDownload = (backup) => {
    if (!backup.file_json) { toast.error('No data stored for this backup'); return; }
    const blob = new Blob([JSON.stringify(backup.file_json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const meta = backup.file_json?.meta || {};
    const dateStr = backup.created_date ? new Date(backup.created_date).toISOString().slice(0, 10) : 'unknown';
    a.href = url;
    a.download = `FeesBackup_${(meta.schoolName || 'School').replace(/\s+/g, '_')}_${meta.academicYear || 'ALL'}_${dateStr}_${backup.backup_type}.json`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
    toast.success('Download started');
  };

  const openRestoreModal = (backup) => {
    setRestoreTarget(backup);
    setRestoreMode('MERGE');
    setRestorePhrase('');
    setRestoreSchool('');
    setRestoreDate('');
    setRestoreResult(null);
  };

  const restoreValid = restorePhrase === 'RESTORE FEES BACKUP'
    && restoreSchool === (schoolProfile?.school_name || '')
    && restoreDate === today;

  const totalRecords = (b) => {
    if (!b.counts_summary) return '-';
    return Object.values(b.counts_summary).reduce((a, c) => a + c, 0);
  };

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-green-600" /> Fees Backup
            </CardTitle>
            <CardDescription>
              {isAdmin ? 'Create, download, export to Drive, and restore fees data.' : 'Create and download fees backups.'}
            </CardDescription>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {createMutation.isPending ? (
              <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
            ) : (
              <><HardDrive className="h-4 w-4 mr-2" /> Backup Now</>
            )}
          </Button>
        </CardHeader>

        {/* Admin-only: Drive settings */}
        {isAdmin && (
          <CardContent className="border-t pt-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-3">
                <Cloud className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Auto-export daily backups to Google Drive</p>
                  <p className="text-xs text-blue-600 mt-0.5">Google Drive is connected ✓. Each nightly backup will be uploaded automatically.</p>
                </div>
              </div>
              <Switch
                checked={autoExportEnabled}
                onCheckedChange={(v) => toggleAutoExportMutation.mutate(v)}
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Backup list */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Backup History</CardTitle>
          <CardDescription>Last 50 backups. Daily auto-backups run at 11:59 PM. Last 30 daily backups are retained.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Loading backups...</div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center">
              <Database className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">No backups yet. Click "Backup Now" to create the first one.</p>
            </div>
          ) : (
            <div className="divide-y">
              {backups.map((b) => (
                <div key={b.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-slate-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-800">
                        {b.created_date ? format(new Date(b.created_date), 'dd MMM yyyy, hh:mm a') : 'Unknown date'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.backup_type === 'DAILY_AUTO' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {b.backup_type === 'DAILY_AUTO' ? 'Auto' : 'Manual'}
                      </span>
                      <BackupStatusBadge status={b.status} />
                      {b.academic_year && <span className="text-xs text-slate-500">{b.academic_year}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> DB Stored
                      </span>
                      <span className="text-xs text-slate-500">{totalRecords(b)} records</span>
                      <DriveStatusBadge status={b.drive_export_status || 'NOT_EXPORTED'} />
                      {b.created_by_user_id && <span className="text-xs text-slate-400">by {b.created_by_user_id}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button size="sm" variant="outline" onClick={() => handleDownload(b)} disabled={b.status !== 'COMPLETED'}>
                      <Download className="h-3.5 w-3.5 mr-1" /> JSON
                    </Button>
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-blue-600 border-blue-200 hover:bg-blue-50"
                        disabled={b.status !== 'COMPLETED' || exportDriveMutation.isPending}
                        onClick={() => exportDriveMutation.mutate(b.id)}
                      >
                        <Cloud className="h-3.5 w-3.5 mr-1" /> Drive
                      </Button>
                    )}
                    {isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        disabled={b.status !== 'COMPLETED'}
                        onClick={() => openRestoreModal(b)}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Restore
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Restore Dialog — Admin only */}
      {isAdmin && (
        <Dialog open={!!restoreTarget} onOpenChange={(o) => { if (!o) { setRestoreTarget(null); setRestoreResult(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" /> Restore Fees Backup
              </DialogTitle>
              <DialogDescription>
                This will overwrite current fees data. Read carefully before proceeding.
              </DialogDescription>
            </DialogHeader>

            {restoreResult ? (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="font-semibold text-green-800 mb-2">✓ Restore Completed</p>
                  <p className="text-sm text-green-700">Mode: <strong>{restoreResult.restoreMode}</strong></p>
                  <p className="text-sm text-green-700">Records restored: <strong>{restoreResult.totalRestored}</strong></p>
                  {restoreResult.restoreMode === 'REPLACE' && (
                    <div className="mt-2 text-xs text-green-700">
                      <p className="font-medium">Deleted before restore:</p>
                      {Object.entries(restoreResult.deletedCounts || {}).map(([k, v]) => (
                        <span key={k} className="mr-3">{k}: {v}</span>
                      ))}
                    </div>
                  )}
                </div>
                <Button className="w-full" onClick={() => { setRestoreTarget(null); setRestoreResult(null); }}>Close</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                  <strong>Backup:</strong> {restoreTarget?.created_date ? format(new Date(restoreTarget.created_date), 'dd MMM yyyy, hh:mm a') : ''} · {totalRecords(restoreTarget)} records
                </div>

                {/* Mode selection */}
                <div>
                  <Label className="text-sm font-medium">Restore Mode</Label>
                  <div className="flex gap-3 mt-2">
                    <button
                      onClick={() => setRestoreMode('MERGE')}
                      className={`flex-1 p-3 rounded-lg border-2 text-sm transition-all ${restoreMode === 'MERGE' ? 'border-green-500 bg-green-50' : 'border-slate-200'}`}
                    >
                      <p className="font-semibold text-green-700">MERGE (Safe)</p>
                      <p className="text-xs text-slate-500 mt-1">Upsert records by ID. No deletions.</p>
                    </button>
                    <button
                      onClick={() => setRestoreMode('REPLACE')}
                      className={`flex-1 p-3 rounded-lg border-2 text-sm transition-all ${restoreMode === 'REPLACE' ? 'border-red-500 bg-red-50' : 'border-slate-200'}`}
                    >
                      <p className="font-semibold text-red-700">REPLACE (⚠ Wipe)</p>
                      <p className="text-xs text-slate-500 mt-1">Delete all fees data then restore.</p>
                    </button>
                  </div>
                </div>

                {/* Confirmations */}
                <div className="space-y-3 border-t pt-3">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Confirm to proceed</p>
                  <div>
                    <Label className="text-xs">Type exactly: <code className="bg-slate-100 px-1 rounded">RESTORE FEES BACKUP</code></Label>
                    <Input className="mt-1 font-mono text-sm" value={restorePhrase} onChange={e => setRestorePhrase(e.target.value)} placeholder="RESTORE FEES BACKUP" />
                  </div>
                  <div>
                    <Label className="text-xs">School name: <code className="bg-slate-100 px-1 rounded">{schoolProfile?.school_name}</code></Label>
                    <Input className="mt-1 text-sm" value={restoreSchool} onChange={e => setRestoreSchool(e.target.value)} placeholder={schoolProfile?.school_name} />
                  </div>
                  <div>
                    <Label className="text-xs">Today's date: <code className="bg-slate-100 px-1 rounded">{today}</code></Label>
                    <Input className="mt-1 text-sm" value={restoreDate} onChange={e => setRestoreDate(e.target.value)} placeholder={today} />
                  </div>
                </div>

                <Button
                  className="w-full bg-red-600 hover:bg-red-700 text-white"
                  disabled={!restoreValid || restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate()}
                >
                  {restoreMutation.isPending ? (
                    <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Restoring...</>
                  ) : (
                    <><ShieldCheck className="h-4 w-4 mr-2" /> Restore Now ({restoreMode})</>
                  )}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}