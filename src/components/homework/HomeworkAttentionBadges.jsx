import React from 'react';
import { AlertCircle, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

/**
 * Render teacher attention badges for SUBMISSION_REQUIRED homework only.
 * These badges help teachers identify important homework requiring attention.
 */
export default function HomeworkAttentionBadges({ homework, metrics }) {
  // Never show badges for VIEW_ONLY homework
  if (homework.submission_mode === 'VIEW_ONLY') {
    return null;
  }

  const badges = [];
  const { submittedCount, gradedCount, revisionRequiredCount, pendingCount, totalStudents } = metrics;

  // Needs Grading: submitted > graded
  if (submittedCount > 0 && gradedCount < submittedCount) {
    const pendingGrading = submittedCount - gradedCount - revisionRequiredCount;
    if (pendingGrading > 0) {
      badges.push({
        id: 'needs-grading',
        label: `Needs Grading (${pendingGrading})`,
        icon: AlertTriangle,
        color: 'bg-orange-100 text-orange-700',
        priority: 1,
      });
    }
  }

  // Low Submission: submitted < 30% of total students
  if (totalStudents > 0 && submittedCount < (totalStudents * 0.3)) {
    badges.push({
      id: 'low-submission',
      label: `Low Submission (${Math.round((submittedCount / totalStudents) * 100)}%)`,
      icon: AlertCircle,
      color: 'bg-red-100 text-red-700',
      priority: 2,
    });
  }

  // Fully Submitted: submitted == total students
  if (submittedCount === totalStudents && totalStudents > 0) {
    badges.push({
      id: 'fully-submitted',
      label: 'Fully Submitted ✓',
      icon: CheckCircle2,
      color: 'bg-green-100 text-green-700',
      priority: 0,
    });
  }

  // Revision Ongoing: revision_required > 0
  if (revisionRequiredCount > 0) {
    badges.push({
      id: 'revision-ongoing',
      label: `Revision Ongoing (${revisionRequiredCount})`,
      icon: Clock,
      color: 'bg-orange-100 text-orange-700',
      priority: 3,
    });
  }

  // Overdue Pending: due_date passed AND pending > 0
  const isOverdue = homework.due_date && new Date(homework.due_date) < new Date();
  if (isOverdue && pendingCount > 0) {
    badges.push({
      id: 'overdue-pending',
      label: `Overdue Pending (${pendingCount})`,
      icon: AlertCircle,
      color: 'bg-red-100 text-red-700',
      priority: 2,
    });
  }

  // Sort by priority and show first badge
  const sortedBadges = badges.sort((a, b) => a.priority - b.priority);
  const primaryBadge = sortedBadges[0];

  if (!primaryBadge) return null;

  const Icon = primaryBadge.icon;

  return (
    <div className={`${primaryBadge.color} px-3 py-1 rounded text-xs font-medium flex items-center gap-1`}>
      <Icon className="h-3.5 w-3.5" />
      {primaryBadge.label}
    </div>
  );
}