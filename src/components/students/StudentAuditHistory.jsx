import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { ShieldCheck } from 'lucide-react';

export default function StudentAuditHistory({ studentId, academicYear }) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', studentId, academicYear],
    queryFn: () => base44.entities.AuditLog.filter(
      { student_id: studentId, ...(academicYear ? { academic_year: academicYear } : {}) },
      '-timestamp',
      200
    ),
    enabled: !!studentId,
  });

  if (isLoading) {
    return <div className="py-10 text-center text-gray-400 text-sm">Loading audit history...</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="py-12 text-center">
        <ShieldCheck className="h-10 w-10 text-gray-200 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No audit records found for this student.</p>
      </div>
    );
  }

  const formatAction = (action) => {
    if (action === 'STUDENT_UPDATED') return 'Student Updated';
    if (action === 'BULK_ROLL_RESEQUENCE') return 'Bulk Roll Resequence';
    if (action === 'student_id_changed') return 'Student ID Changed';
    return action;
  };

  const formatChangedFields = (log) => {
    if (log.changed_fields && log.changed_fields.length > 0) {
      return (
        <div className="space-y-1">
          {log.changed_fields.map((cf, i) => (
            <div key={i} className="text-xs text-gray-700">
              <span className="font-semibold text-gray-900">{cf.field}</span>
              {': '}
              <span className="text-red-500 line-through">{String(cf.old_value ?? '—')}</span>
              {' → '}
              <span className="text-green-600 font-semibold">{String(cf.new_value ?? '—')}</span>
            </div>
          ))}
        </div>
      );
    }
    return <span className="text-xs text-gray-500">{log.details || '—'}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wide">Date</th>
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wide">Action</th>
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wide">Field Changes</th>
            <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3 uppercase tracking-wide">Changed By</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                {log.timestamp
                  ? format(new Date(log.timestamp), 'dd MMM yyyy, hh:mm a')
                  : log.date
                  ? format(new Date(log.date), 'dd MMM yyyy')
                  : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                  log.action === 'STUDENT_UPDATED' ? 'bg-blue-100 text-blue-700' :
                  log.action === 'BULK_ROLL_RESEQUENCE' ? 'bg-amber-100 text-amber-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {formatAction(log.action)}
                </span>
              </td>
              <td className="px-4 py-3 max-w-xs">{formatChangedFields(log)}</td>
              <td className="px-4 py-3 text-xs text-gray-600">{log.performed_by || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}