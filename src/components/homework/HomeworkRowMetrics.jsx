import React from 'react';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, isPast } from 'date-fns';

const statusBadges = {
  'Draft': { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Draft' },
  'Published': { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Published' },
  'Closed': { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Closed' },
};

const quickBadges = {
  'No Submissions Yet': { bg: 'bg-gray-100', text: 'text-gray-700' },
  'Fully Submitted': { bg: 'bg-blue-100', text: 'text-blue-700' },
  'Pending Review': { bg: 'bg-orange-100', text: 'text-orange-700' },
  'Needs Attention': { bg: 'bg-red-100', text: 'text-red-700' },
  'Overdue': { bg: 'bg-red-100', text: 'text-red-700' },
  'Revision Ongoing': { bg: 'bg-orange-100', text: 'text-orange-700' },
};

export default function HomeworkRowMetrics({
  homework,
  totalStudents = 0,
  submittedCount = 0,      // Latest status = SUBMITTED or RESUBMITTED
  pendingCount = 0,
  gradedCount = 0,         // Latest status = GRADED
  revisionRequiredCount = 0, // Latest status = REVISION_REQUIRED
  lateSubmissionCount = 0,  // Unique students with latest submission marked late
}) {
  const completionPercent = totalStudents > 0 ? Math.round(((submittedCount + gradedCount + revisionRequiredCount) / totalStudents) * 100) : 0;

  // Determine status
  const isOverdue = homework.due_date && isPast(new Date(homework.due_date));
  const statusLabel = isOverdue ? 'Closed' : homework.status;
  const statusStyle = statusBadges[statusLabel] || statusBadges['Published'];

  // Determine quick badges
  const quickBadgeList = [];
  if (submittedCount === 0) quickBadgeList.push('No Submissions Yet');
  if (submittedCount === totalStudents && totalStudents > 0) quickBadgeList.push('Fully Submitted');
  if (gradedCount > 0 && gradedCount < submittedCount) quickBadgeList.push('Pending Review');
  if (pendingCount > 0 || revisionRequiredCount > 0) quickBadgeList.push('Needs Attention');
  if (isOverdue && pendingCount > 0) quickBadgeList.push('Overdue');
  if (revisionRequiredCount > 0) quickBadgeList.push('Revision Ongoing');

  const primaryBadge = quickBadgeList[0];

  return (
    <div className="space-y-3">
      {/* Header info */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-sm text-gray-900 flex-1">{homework.title}</h3>
        <div className={`${statusStyle.bg} ${statusStyle.text} px-2 py-1 rounded text-xs font-medium`}>
          {statusLabel}
        </div>
        {primaryBadge && (
          <div className={`${quickBadges[primaryBadge]?.bg} ${quickBadges[primaryBadge]?.text} px-2 py-1 rounded text-xs font-medium`}>
            {primaryBadge}
          </div>
        )}
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span><strong>Class:</strong> {homework.class_name}</span>
        {homework.section && homework.section !== 'All' && <span><strong>Section:</strong> {homework.section}</span>}
        <span><strong>Subject:</strong> {homework.subject}</span>
        {homework.due_date && (
          <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
            <strong>Due:</strong> {formatDistanceToNow(new Date(homework.due_date), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
        <div className="bg-gray-50 rounded p-2">
          <p className="text-xs font-bold text-gray-900">{totalStudents}</p>
          <p className="text-[10px] text-gray-600">Total</p>
        </div>
        <div className="bg-blue-50 rounded p-2">
          <p className="text-xs font-bold text-blue-700">{submittedCount}</p>
          <p className="text-[10px] text-blue-600">Submitted</p>
        </div>
        <div className="bg-orange-50 rounded p-2">
          <p className="text-xs font-bold text-orange-700">{pendingCount}</p>
          <p className="text-[10px] text-orange-600">Pending</p>
        </div>
        <div className="bg-green-50 rounded p-2">
          <p className="text-xs font-bold text-green-700">{gradedCount}</p>
          <p className="text-[10px] text-green-600">Graded</p>
        </div>
        <div className="bg-red-50 rounded p-2">
          <p className="text-xs font-bold text-red-700">{revisionRequiredCount}</p>
          <p className="text-[10px] text-red-600">Revision</p>
        </div>
        <div className="bg-yellow-50 rounded p-2">
          <p className="text-xs font-bold text-yellow-700">{lateSubmissionCount}</p>
          <p className="text-[10px] text-yellow-600">Late</p>
        </div>
      </div>

      {/* Completion progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-gray-700">Completion</span>
          <span className="text-xs font-bold text-indigo-600">{completionPercent}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-indigo-600 h-full transition-all duration-300"
            style={{ width: `${completionPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}