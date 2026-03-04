import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertCircle, Download, Upload, Clock, CheckCircle2, AlertTriangle, Loader2, HardDrive } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import GoogleDriveFolderPickerDialog from '@/components/GoogleDriveFolderPicker';

const DriveStatusBadge = ({ status }) => {
  const config = {
    NOT_EXPORTED: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Not Exported' },
    EXPORTED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Exported' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Export Failed' }
  }[status] || { bg: 'bg-gray-100', text: 'text-gray-700', label: '—' };
  return <Badge className={`${config.bg} ${config.text}`}>{config.label}</Badge>;
};

export default function FullBackupTab({ profile, onProfileUpdate }) {
  const queryClient = useQueryClient();
  const [showFolderPickerDialog, setShowFolderPickerDialog] = useState(false);

  // Fetch backups
  const { data: backups = [], isLoading } = useQuery({
    queryKey: ['fullSchoolBackups'],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('listFullSchoolBackups', { limit: 50 });
        return res.data || [];
      } catch {
        return [];
      }
    }
  });

  // Calculate last weekly backup
  const lastWeeklyBackup = backups.find(b => b.backup_type === 'WEEKLY_AUTO' && b.status === 'COMPLETED');
  const daysAgo = lastWeeklyBackup 
    ? Math.floor((Date.now() - new Date(lastWeeklyBackup.created_date)) / (1000 * 60 * 60 * 24))
    : null;

  // Create backup mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('createFullSchoolBackup', { backupType: 'MANUAL' });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fullSchoolBackups'] });
      toast.success('Full school backup created');
    },
    onError: (e) => {
      toast.error(e.response?.data?.error || 'Backup failed');
    }
  });

  // Toggle auto-export mutation
  const toggleAutoExportMutation = useMutation({
    mutationFn: async (enabled) => {
      const res = await base44.entities.SchoolProfile.update(profile.id, {
        auto_export_full_backup_to_drive: enabled
      });
      return res;
    },
    onSuccess: (data) => {
      onProfileUpdate(data);
      toast.success('Setting updated');
    },
    onError: (e) => {
      toast.error('Failed to update setting');
    }
  });

  // Export to Drive mutation
  const exportToDevMutation = useMutation({
    mutationFn: async (backupId) => {
      const res = await base44.functions.invoke('exportFullSchoolBackupToDrive', {
        backupId,
        folderId: profile.full_backup_drive_folder_id
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fullSchoolBackups'] });
      toast.success('Backup exported to Google Drive');
    },
    onError: (e) => {
      toast.error(e.response?.data?.error || 'Export failed');
    }
  });

  // Save folder mutation
  const saveFolderMutation = useMutation({
    mutationFn: async ({ folderId, folderName }) => {
      return base44.entities.SchoolProfile.update(profile.id, {
        full_backup_drive_folder_id: folderId,
        full_backup_drive_folder_name: folderName
      });
    },
    onSuccess: (data) => {
      onProfileUpdate(data);
      toast.success('Google Drive folder connected successfully');
      setShowFolderPickerDialog(false);
    },
    onError: (e) => {
      toast.error('Failed to save folder');
    }
  });

  // Handle folder selection from picker dialog
  const handleFolderSelected = (folder) => {
    saveFolderMutation.mutate({
      folderId: folder.folderId,
      folderName: folder.folderName
    });
  };

  // Download backup JSON
  const downloadBackup = (backup) => {
    const json = JSON.stringify(backup.file_json, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FullBackup_${backup.academic_year || 'ALL'}_${format(new Date(backup.created_date), 'yyyy-MM-dd_HHmm')}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Settings Section */}
      <Card>
        <CardHeader>
          <CardTitle>Full School Backup Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drive Folder Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Google Drive Folder for Full Backups</label>
            <p className="text-xs text-gray-500 mb-2">
              {profile?.full_backup_drive_folder_id 
                ? `Folder selected: ${profile.full_backup_drive_folder_id}`
                : 'No folder selected yet'}
            </p>
            <Button 
              variant="outline"
              onClick={handleSelectFolder}
              className="w-full"
            >
              <Upload className="h-4 w-4 mr-2" />
              Select Google Drive Folder
            </Button>
          </div>

          {/* Auto-export Toggle */}
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div>
              <label className="text-sm font-medium">Auto-export Weekly Backups</label>
              <p className="text-xs text-gray-500">Automatically upload weekly backups to Google Drive</p>
            </div>
            <Button
              variant={profile?.auto_export_full_backup_to_drive ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleAutoExportMutation.mutate(!profile?.auto_export_full_backup_to_drive)}
              disabled={!profile?.full_backup_drive_folder_id || toggleAutoExportMutation.isPending}
              className="ml-2"
            >
              {toggleAutoExportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (profile?.auto_export_full_backup_to_drive ? '✓ On' : 'Off')}
            </Button>
          </div>

          {/* Manual Backup Button */}
          <Button
            onClick={() => createBackupMutation.mutate()}
            disabled={createBackupMutation.isPending}
            className="w-full bg-indigo-600 hover:bg-indigo-700"
          >
            {createBackupMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Backing up...</> : '📦 Backup Now (Full)'}
          </Button>
        </CardContent>
      </Card>

      {/* Health Status */}
      {lastWeeklyBackup && daysAgo !== null && (
        <Card className={daysAgo > 7 ? 'border-yellow-300' : ''}>
          <CardContent className="pt-6">
            <div className={`flex items-center gap-3 p-3 rounded-lg ${daysAgo > 7 ? 'bg-yellow-50' : 'bg-green-50'}`}>
              {daysAgo > 7 ? <AlertTriangle className="h-5 w-5 text-yellow-600" /> : <CheckCircle2 className="h-5 w-5 text-green-600" />}
              <div>
                <p className={`text-sm font-medium ${daysAgo > 7 ? 'text-yellow-800' : 'text-green-800'}`}>
                  Last Weekly Backup: {daysAgo} days ago
                </p>
                <p className="text-xs text-gray-600">{format(new Date(lastWeeklyBackup.created_date), 'PPp')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backups Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Backup History
          </CardTitle>
          <CardDescription>Database-stored backups (last 50)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-6 text-gray-500">Loading...</div>
          ) : backups.length === 0 ? (
            <div className="text-center py-6 text-gray-500">No backups yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Date/Time</th>
                    <th className="px-4 py-2 text-left font-medium">Type</th>
                    <th className="px-4 py-2 text-left font-medium">Academic Year</th>
                    <th className="px-4 py-2 text-center font-medium">Records</th>
                    <th className="px-4 py-2 text-center font-medium">Drive Status</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {backups.map((backup) => (
                    <tr key={backup.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{format(new Date(backup.created_date), 'dd MMM HH:mm')}</td>
                      <td className="px-4 py-2">
                        <Badge variant={backup.backup_type === 'MANUAL' ? 'default' : 'secondary'}>
                          {backup.backup_type === 'MANUAL' ? '✋ Manual' : '⏰ Weekly'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-gray-600">{backup.academic_year || 'All'}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {Object.values(backup.counts_summary || {}).reduce((a, b) => a + b, 0)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <DriveStatusBadge status={backup.drive_export_status} />
                      </td>
                      <td className="px-4 py-2 text-right space-x-2 flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadBackup(backup)}
                          title="Download JSON"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {backup.drive_export_status !== 'EXPORTED' && profile?.full_backup_drive_folder_id && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => exportToDevMutation.mutate(backup.id)}
                            disabled={exportToDevMutation.isPending}
                          >
                            {exportToDevMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium">Weekly Backup Schedule</p>
              <p className="text-xs mt-1">Automated backups run every Sunday at 11:59 PM (school timezone). Last 12 weekly backups are retained; all manual backups are kept indefinitely.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}