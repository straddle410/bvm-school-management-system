import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCw, Trash2, CheckCircle, Shield } from 'lucide-react';

const ENTITIES = [
  'ProgressCard',
  'HallTicket',
  'HallTicketLog',
  'ExamTimetable',
  'Marks',
  'Attendance',
  'ExamType',
  'Holiday',
  'AuditLog',
];

const PROTECTED = ['Student', 'Teacher', 'AcademicYear'];

export default function ProductionReset() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState({});
  const [results, setResults] = useState({});
  const [confirmed, setConfirmed] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => setUser(u)).catch(() => {});
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    const res = await base44.functions.invoke('productionResetEntity', {});
    setStatus(res.data);
    setLoading(false);
  };

  const deleteEntity = async (entityName) => {
    setDeleting(d => ({ ...d, [entityName]: true }));
    const res = await base44.functions.invoke('productionResetEntity', { entityName });
    setResults(r => ({ ...r, [entityName]: res.data }));
    setDeleting(d => ({ ...d, [entityName]: false }));
    // Refresh status
    const statusRes = await base44.functions.invoke('productionResetEntity', {});
    setStatus(statusRes.data);
  };

  const deleteAll = async () => {
    for (const entity of ENTITIES) {
      if ((status?.transactional_entities?.[entity] ?? 0) > 0) {
        await deleteEntity(entity);
      }
    }
  };

  if (user && user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="text-center">
          <Shield className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <h2 className="text-xl font-bold text-red-700">Access Denied</h2>
          <p className="text-red-600 mt-1">Admin only.</p>
        </div>
      </div>
    );
  }

  const transactional = status?.transactional_entities ?? {};
  const protected_ = status?.protected_entities ?? {};
  const totalRemaining = Object.values(transactional).reduce((a, b) => a + b, 0);
  const allClean = totalRemaining === 0;

  return (
    <div className="min-h-screen bg-gray-50 p-4 max-w-2xl mx-auto">
      {/* Header */}
      <div className="bg-red-600 text-white rounded-xl p-5 mb-5 flex items-start gap-3">
        <AlertTriangle className="h-7 w-7 mt-0.5 flex-shrink-0" />
        <div>
          <h1 className="text-xl font-bold">Production Reset</h1>
          <p className="text-red-100 text-sm mt-0.5">
            Permanently deletes all transactional academic data. Students, Staff, and Academic Year config are protected.
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Current Record Counts</h2>
          <button onClick={fetchStatus} disabled={loading} className="text-xs text-blue-600 flex items-center gap-1 hover:underline">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="space-y-2">
          {ENTITIES.map(e => {
            const count = transactional[e] ?? '...';
            const result = results[e];
            const isDeleting = deleting[e];
            const isDone = result?.clean === true;
            return (
              <div key={e} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <span className="text-sm font-medium text-gray-700">{e}</span>
                <div className="flex items-center gap-3">
                  {isDone ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">✓ Deleted ({result.deleted})</Badge>
                  ) : (
                    <Badge className={count > 0 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-gray-100 text-gray-500 border-gray-200'}>
                      {count} records
                    </Badge>
                  )}
                  {!isDone && count > 0 && confirmed && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-7 text-xs"
                      disabled={isDeleting}
                      onClick={() => deleteEntity(e)}
                    >
                      {isDeleting ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      {isDeleting ? 'Deleting…' : 'Delete'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Protected entities */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="h-4 w-4 text-green-600" />
          <h2 className="font-semibold text-green-800 text-sm">Protected — Will NOT be deleted</h2>
        </div>
        <div className="flex gap-4">
          {PROTECTED.map(e => (
            <div key={e} className="text-sm">
              <span className="text-green-700 font-medium">{e}:</span>{' '}
              <span className="text-green-800">{protected_[e] ?? '...'} records</span>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation + Actions */}
      {!allClean && (
        <div className="bg-white border rounded-xl p-4 space-y-3">
          {!confirmed ? (
            <div>
              <p className="text-sm text-gray-700 mb-3">
                ⚠️ This will permanently delete <strong>{totalRemaining} records</strong> across {ENTITIES.length} entities. This cannot be undone.
              </p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={() => setConfirmed(true)}
              >
                I understand — Unlock Reset Controls
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-red-700">Reset controls unlocked. Proceed carefully.</p>
              <Button
                variant="destructive"
                className="w-full"
                onClick={deleteAll}
                disabled={Object.values(deleting).some(Boolean)}
              >
                {Object.values(deleting).some(Boolean)
                  ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Deleting…</>
                  : <><Trash2 className="h-4 w-4 mr-2" /> Delete All Transactional Data</>
                }
              </Button>
              <p className="text-xs text-gray-500 text-center">Or delete entities individually above</p>
            </div>
          )}
        </div>
      )}

      {/* All clean */}
      {allClean && (
        <div className="bg-green-50 border border-green-300 rounded-xl p-5 text-center">
          <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-green-800">System Clean ✓</h2>
          <p className="text-green-700 text-sm mt-1">All transactional data deleted. Ready for fresh academic data entry.</p>
          {Object.keys(results).length > 0 && (
            <div className="mt-3 text-left bg-white rounded-lg border border-green-200 p-3 text-xs text-gray-600 space-y-1">
              {Object.entries(results).map(([e, r]) => (
                <div key={e} className="flex justify-between">
                  <span>{e}</span>
                  <span className="text-green-700 font-medium">Deleted: {r.deleted}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}