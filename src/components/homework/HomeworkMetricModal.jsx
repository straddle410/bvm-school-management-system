import React from 'react';
import { X, FileText } from 'lucide-react';
import { HOMEWORK_STATUS, normalizeHomeworkSubmissionStatus } from '@/components/utils/homeworkStatusHelper';

// Shows students belonging to a specific metric bucket (submitted/pending/graded/revision/late)
export default function HomeworkMetricModal({ type, submissions, assignedStudents, homework, onClose, onOpenSubmission }) {
  const latestMap = new Map();
  submissions.forEach((sub) => {
    const key = sub.student_id;
    const current = latestMap.get(key);
    const subTs = new Date(sub.submitted_at || sub.updated_at || 0).getTime();
    const curTs = current ? new Date(current.submitted_at || current.updated_at || 0).getTime() : 0;
    if (!current || subTs > curTs) {
      latestMap.set(key, { ...sub, status: normalizeHomeworkSubmissionStatus(sub.status) });
    }
  });

  const submittedStudentIds = new Set(latestMap.keys());

  let rows = [];

  if (type === 'submitted') {
    rows = Array.from(latestMap.values()).filter(s =>
      s.status === HOMEWORK_STATUS.SUBMITTED || s.status === HOMEWORK_STATUS.RESUBMITTED
    ).map(s => ({ student_id: s.student_id, student_name: s.student_name, status: s.status, submission: s }));
  } else if (type === 'pending') {
    rows = assignedStudents
      .filter(st => !submittedStudentIds.has(st.student_id))
      .map(st => ({ student_id: st.student_id, student_name: st.name, status: 'Pending', roll_no: st.roll_no, submission: null }));
  } else if (type === 'graded') {
    rows = Array.from(latestMap.values()).filter(s => s.status === HOMEWORK_STATUS.GRADED)
      .map(s => ({ student_id: s.student_id, student_name: s.student_name, status: s.status, submission: s }));
  } else if (type === 'revision') {
    rows = Array.from(latestMap.values()).filter(s => s.status === HOMEWORK_STATUS.REVISION_REQUIRED)
      .map(s => ({ student_id: s.student_id, student_name: s.student_name, status: s.status, submission: s }));
  } else if (type === 'late') {
    rows = Array.from(latestMap.values()).filter(s => s.is_late)
      .map(s => ({ student_id: s.student_id, student_name: s.student_name, status: s.status, submission: s }));
  }

  // Enrich with roll_no from assignedStudents
  const studentMap = new Map(assignedStudents.map(st => [st.student_id, st]));
  rows = rows.map(r => ({ ...r, roll_no: r.roll_no ?? studentMap.get(r.student_id)?.roll_no ?? '—' }));

  const titles = {
    submitted: '✅ Submitted Students',
    pending: '⏳ Pending Students',
    graded: '⭐ Graded Students',
    revision: '⚠ Revision Required',
    late: '🕒 Late Submissions',
  };

  const statusColors = {
    [HOMEWORK_STATUS.SUBMITTED]: 'bg-blue-100 text-blue-700',
    [HOMEWORK_STATUS.RESUBMITTED]: 'bg-indigo-100 text-indigo-700',
    [HOMEWORK_STATUS.GRADED]: 'bg-green-100 text-green-700',
    [HOMEWORK_STATUS.REVISION_REQUIRED]: 'bg-orange-100 text-orange-700',
    Pending: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-end justify-center sm:items-center" style={{ overscrollBehavior: 'contain' }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-bold text-slate-800">{titles[type]}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{homework.title} · {rows.length} student{rows.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1"><X className="h-5 w-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' }}>
          {rows.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">No students in this category.</p>
          ) : (
            rows.map((row, idx) => (
              <div key={row.student_id || idx} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{row.student_name || '—'}</p>
                  <p className="text-xs text-gray-500">ID: {row.student_id} · Roll: {row.roll_no}</p>
                  {row.submission?.teacher_marks !== undefined && (
                    <p className="text-xs text-green-700 font-medium mt-0.5">Marks: {row.submission.teacher_marks}{homework.max_marks ? `/${homework.max_marks}` : ''}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[row.status] || 'bg-gray-100 text-gray-600'}`}>
                    {row.status}
                  </span>
                  {row.submission && onOpenSubmission && (
                    <button
                      onClick={() => { onOpenSubmission(row.submission); onClose(); }}
                      className="text-[10px] text-indigo-600 font-medium flex items-center gap-1 hover:underline"
                    >
                      <FileText className="h-3 w-3" /> View
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}