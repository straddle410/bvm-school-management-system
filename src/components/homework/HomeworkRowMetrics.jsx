import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow, isPast } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { getHomeworkAggregatedMetrics } from '@/components/homework/homeworkAggregationHelper';
import { getEffectiveDueDate } from '@/components/utils/homeworkStatusHelper';
import HomeworkViewOnlyCard from '@/components/homework/HomeworkViewOnlyCard';
import HomeworkTypeIndicator from '@/components/homework/HomeworkTypeIndicator';
import HomeworkAttentionBadges from '@/components/homework/HomeworkAttentionBadges';
import PendingStudentsList from '@/components/homework/PendingStudentsList';
import HomeworkMetricModal from '@/components/homework/HomeworkMetricModal';

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
  submissions = [],
  assignedStudents = [],
}) {
  // VIEW_ONLY homework: use simplified card
  if (homework.submission_mode === 'VIEW_ONLY') {
    return <HomeworkViewOnlyCard homework={homework} />;
  }

  // SUBMISSION_REQUIRED: show full metrics
  const [metrics, setMetrics] = useState(null);
  const [students, setStudents] = useState([]);
  const [activeModal, setActiveModal] = useState(null); // 'submitted'|'pending'|'graded'|'revision'|'late'

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        // Get assigned students if not provided
        let students = assignedStudents;
        if (assignedStudents.length === 0) {
          const studentFilter = {
            class_name: homework.class_name,
            is_deleted: false,
            is_active: true,
            status: 'Published',
            academic_year: homework.academic_year,
          };
          if (homework.section && homework.section !== 'All') {
            studentFilter.section = homework.section;
          }
          students = await base44.entities.Student.filter(studentFilter, 'student_id', 500);
        }
        
        setStudents(students);
        const calculated = getHomeworkAggregatedMetrics(homework, submissions, students);
        setMetrics(calculated);
      } catch (err) {
        console.error('Error loading metrics:', err);
        // Fallback to empty metrics
        setMetrics({
          totalStudents: 0,
          submittedCount: 0,
          pendingCount: 0,
          gradedCount: 0,
          revisionRequiredCount: 0,
          lateCount: 0,
          completionPercent: 0,
        });
      }
    };
    
    loadMetrics();
  }, [homework, submissions, assignedStudents]);

  if (!metrics) return <div className="text-center py-2 text-gray-400">Loading metrics...</div>;

  const totalStudents = metrics.totalStudents;
  const submittedCount = metrics.submittedCount;
  const pendingCount = metrics.pendingCount;
  const gradedCount = metrics.gradedCount;
  const revisionRequiredCount = metrics.revisionRequiredCount;
  const lateSubmissionCount = metrics.lateCount;
  const notSubmittedCount = metrics.notSubmittedCount || 0;
  const completionPercent = metrics.completionPercent;

  // Use effective_due_date for overdue logic
  const effectiveDueDate = getEffectiveDueDate(homework);
  const isOverdue = effectiveDueDate && isPast(new Date(effectiveDueDate + 'T23:59:59'));
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
        
        {/* Homework type indicator */}
        <HomeworkTypeIndicator homework={homework} />
        
        {/* Status badge */}
        <div className={`${statusStyle.bg} ${statusStyle.text} px-2 py-1 rounded text-xs font-medium`}>
          {statusLabel}
        </div>
        
        {/* Teacher attention badge */}
        <HomeworkAttentionBadges homework={homework} metrics={metrics} />
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

      {/* Metrics grid — each cell is clickable */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
        <div className="bg-gray-50 rounded p-2">
          <p className="text-xs font-bold text-gray-900">{totalStudents}</p>
          <p className="text-[10px] text-gray-600">Total</p>
        </div>
        <button onClick={() => submittedCount > 0 && setActiveModal('submitted')} className={`bg-blue-50 rounded p-2 text-center transition-colors ${submittedCount > 0 ? 'hover:bg-blue-100 cursor-pointer' : 'cursor-default'}`}>
          <p className="text-xs font-bold text-blue-700">{submittedCount}</p>
          <p className="text-[10px] text-blue-600">Submitted</p>
        </button>
        <button onClick={() => pendingCount > 0 && setActiveModal('pending')} className={`bg-orange-50 rounded p-2 text-center transition-colors ${pendingCount > 0 ? 'hover:bg-orange-100 cursor-pointer' : 'cursor-default'}`}>
          <p className="text-xs font-bold text-orange-700">{pendingCount}</p>
          <p className="text-[10px] text-orange-600">Pending</p>
        </button>
        <button onClick={() => gradedCount > 0 && setActiveModal('graded')} className={`bg-green-50 rounded p-2 text-center transition-colors ${gradedCount > 0 ? 'hover:bg-green-100 cursor-pointer' : 'cursor-default'}`}>
          <p className="text-xs font-bold text-green-700">{gradedCount}</p>
          <p className="text-[10px] text-green-600">Graded</p>
        </button>
        <button onClick={() => revisionRequiredCount > 0 && setActiveModal('revision')} className={`bg-red-50 rounded p-2 text-center transition-colors ${revisionRequiredCount > 0 ? 'hover:bg-red-100 cursor-pointer' : 'cursor-default'}`}>
          <p className="text-xs font-bold text-red-700">{revisionRequiredCount}</p>
          <p className="text-[10px] text-red-600">Revision</p>
        </button>
        <button onClick={() => lateSubmissionCount > 0 && setActiveModal('late')} className={`bg-yellow-50 rounded p-2 text-center transition-colors ${lateSubmissionCount > 0 ? 'hover:bg-yellow-100 cursor-pointer' : 'cursor-default'}`}>
          <p className="text-xs font-bold text-yellow-700">{lateSubmissionCount}</p>
          <p className="text-[10px] text-yellow-600">Late</p>
        </button>
      </div>

      {/* Metric detail modal */}
      {activeModal && (
        <HomeworkMetricModal
          type={activeModal}
          submissions={submissions}
          assignedStudents={students}
          homework={homework}
          onClose={() => setActiveModal(null)}
        />
      )}

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

      {/* Pending students reminder */}
      <PendingStudentsList homework={homework} submissions={submissions} />
    </div>
  );
}