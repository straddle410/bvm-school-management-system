import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { formatIST } from '@/components/utils/istFormatter';

export default function BackupHealthIndicator() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackupHealth();
  }, []);

  const loadBackupHealth = async () => {
    try {
      setLoading(true);
      
      // Fetch last FeesBackup
      const feesBackups = await base44.entities.FeesBackup.filter(
        { status: 'COMPLETED' },
        '-created_date',
        1
      );
      const lastFeesBackup = feesBackups[0];

      // Fetch last FullSchoolBackup
      const fullBackups = await base44.entities.FullSchoolBackup.filter(
        { status: 'COMPLETED' },
        '-created_date',
        1
      );
      const lastFullBackup = fullBackups[0];

      // Calculate health
      const statuses = {
        fees: null,
        full: null,
        drive: null,
        overall: 'healthy'
      };

      // Fees Backup Health (last 24 hours)
      if (lastFeesBackup) {
        const hoursAgo = (Date.now() - new Date(lastFeesBackup.created_date)) / (1000 * 60 * 60);
        statuses.fees = hoursAgo < 24 ? 'ok' : 'warning';
      } else {
        statuses.fees = 'warning';
      }

      // Full Backup Health (last 7 days)
      if (lastFullBackup) {
        const daysAgo = (Date.now() - new Date(lastFullBackup.created_date)) / (1000 * 60 * 60 * 24);
        statuses.full = daysAgo < 7 ? 'ok' : 'warning';
      } else {
        statuses.full = 'warning';
      }

      // Drive Export Health
      if (lastFullBackup?.drive_export_status === 'EXPORTED') {
        statuses.drive = 'ok';
      } else if (lastFullBackup?.drive_export_status === 'FAILED') {
        statuses.drive = 'failed';
      } else {
        statuses.drive = 'warning';
      }

      // Overall status
      if (statuses.drive === 'failed') {
        statuses.overall = 'failed';
      } else if (
        statuses.fees === 'warning' ||
        statuses.full === 'warning' ||
        statuses.drive === 'warning'
      ) {
        statuses.overall = 'warning';
      } else {
        statuses.overall = 'healthy';
      }

      setHealth({
        statuses,
        lastFeesBackup,
        lastFullBackup
      });
    } catch (error) {
      console.error('Failed to load backup health:', error);
      setHealth({
        statuses: {
          fees: 'warning',
          full: 'warning',
          drive: 'warning',
          overall: 'warning'
        },
        error: true
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading backup status...
          </div>
        </CardContent>
      </Card>
    );
  }

  const getOverallIcon = () => {
    switch (health?.statuses.overall) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'ok':
        return <Badge className="bg-green-100 text-green-800">✓ OK</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">⚠ Warning</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">✕ Failed</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">—</Badge>;
    }
  };

  const getOverallBadge = () => {
    switch (health?.statuses.overall) {
      case 'healthy':
        return <Badge className="bg-green-100 text-green-800">🟢 Healthy</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">🟡 Attention</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800">🔴 Backup Failure</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">—</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            {getOverallIcon()}
            Backup Health Monitor
          </CardTitle>
          <button
            onClick={loadBackupHealth}
            className="text-sm text-blue-600 hover:text-blue-700"
            title="Refresh"
          >
            🔄 Refresh
          </button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Status */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <span className="font-medium">Overall Status</span>
          {getOverallBadge()}
        </div>

        {/* Fees Backup */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Fees Backup (24h)</span>
            {getStatusBadge(health?.statuses.fees)}
          </div>
          {health?.lastFeesBackup ? (
            <p className="text-xs text-gray-600">
              Last: {formatIST(health.lastFeesBackup.created_date, 'short')}
            </p>
          ) : (
            <p className="text-xs text-gray-500">No backup found</p>
          )}
        </div>

        {/* Full School Backup */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Full Backup (7d)</span>
            {getStatusBadge(health?.statuses.full)}
          </div>
          {health?.lastFullBackup ? (
            <p className="text-xs text-gray-600">
              Last: {formatIST(health.lastFullBackup.created_date, 'short')}
            </p>
          ) : (
            <p className="text-xs text-gray-500">No backup found</p>
          )}
        </div>

        {/* Drive Export */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Drive Export</span>
            {getStatusBadge(health?.statuses.drive)}
          </div>
          {health?.lastFullBackup ? (
            <p className="text-xs text-gray-600">
              Status: {health.lastFullBackup.drive_export_status || 'Unknown'}
            </p>
          ) : (
            <p className="text-xs text-gray-500">No backup found</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}