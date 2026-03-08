import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Download, CheckCircle, Clock, FileText, AlertCircle, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { HOMEWORK_STATUS, normalizeHomeworkSubmissionStatus } from '@/components/utils/homeworkStatusHelper';
import HomeworkDetailAnalyticsHeader from '@/components/homework/HomeworkDetailAnalyticsHeader';
import StudentProgressSegmentation from '@/components/homework/StudentProgressSegmentation';
import { getMarksStatistics } from '@/components/homework/homeworkMetricsHelper';
import { canManageHomework, isHomeworkAdmin } from '@/components/homework/homeworkAccessControl';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function HomeworkSubmissions({ homework, onClose }) {
  const { academicYear } = useAcademicYear();
  const [gradingId, setGradingId] = useState(null);
  const [revisionId, setRevisionId] = useState(null);
  const [editGradeId, setEditGradeId] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const [editStatus, setEditStatus] = useState(HOMEWORK_STATUS.GRADED);
  const [showSegmentation, setShowSegmentation] = useState(false);
  const qc = useQueryClient();
  const user = getStaffSession();
  
  // ACCESS CONTROL: Check if user can view this homework
  const canAccess = canManageHomework(homework, user);
  if (!canAccess) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" style={{ paddingBottom: '64px' }}>
        <div className="bg-white w-full max-w-md rounded-2xl p-6 flex flex-col items-center gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <div className="text-center">
            <h2 className="font-bold text-slate-800 mb-2">Access Denied</h2>
            <p className="text-sm text-gray-600">You do not have permission to view or manage this homework.</p>
          </div>
          <button
            onClick={onClose}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-2 rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const { data: submissions = [], isLoading: submissionsLoading } = useQuery({
    queryKey: ['hw-submissions', homework.id, academicYear],
    queryFn: () => base44.entities.HomeworkSubmission.filter({ homework_id: homework.id }, '-created_date', 200),
    enabled: !!academicYear
  });

  // Query assigned students for this homework's class/section
  const { data: assignedStudents = [] } = useQuery({
    queryKey: ['hw-assigned-students', homework.class_name, homework.section, academicYear],
    queryFn: async () => {
      // Build filter for students matching this homework's class/section
      const studentFilter = {
        class_name: homework.class_name,
        is_deleted: false,
        status: 'Published',
        academic_year: academicYear
      };

      // Add section filter
      if (homework.section && homework.section !== 'All') {
        studentFilter.section = homework.section;
      }
      // If section is "All", we already have class_name, no section filter needed

      return base44.entities.Student.filter(studentFilter, 'student_id', 500);
    },
    enabled: !!academicYear
  });

  const gradeMutation = useMutation({
    mutationFn: ({ id, teacher_marks, teacher_feedback }) => {
      // VERIFY ACCESS before mutation
      if (!canAccess) {
        throw new Error('FORBIDDEN: Cannot grade this homework');
      }
      return base44.entities.HomeworkSubmission.update(id, { 
        teacher_marks: Number(teacher_marks), 
        teacher_feedback, 
        status: HOMEWORK_STATUS.GRADED,
        graded_at: new Date().toISOString(),
        graded_by: user?.name || 'Teacher'
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-submissions', homework.id] });
      setGradingId(null); setMarks(''); setFeedback('');
    }
  });

  const editGradeMutation = useMutation({
    mutationFn: ({ id, teacher_marks, teacher_feedback, newStatus }) => {
      if (!canAccess) throw new Error('FORBIDDEN');
      const marksNum = Number(teacher_marks);
      if (marksNum < 0) throw new Error('NEGATIVE_MARKS');
      if (homework.max_marks && marksNum > Number(homework.max_marks)) throw new Error('EXCEEDS_MAX');
      return base44.entities.HomeworkSubmission.update(id, {
        teacher_marks: marksNum,
        teacher_feedback,
        status: newStatus,
        graded_at: new Date().toISOString(),
        graded_by: user?.name || 'Teacher',
        updated_at: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-submissions', homework.id] });
      setEditGradeId(null); setMarks(''); setFeedback(''); setEditStatus(HOMEWORK_STATUS.GRADED);
    },
    onError: (error) => {
      if (error.message === 'NEGATIVE_MARKS') alert('Marks cannot be negative.');
      else if (error.message === 'EXCEEDS_MAX') alert(`Marks cannot exceed max marks (${homework.max_marks}).`);
      else if (error.message === 'FORBIDDEN') alert('You do not have permission to edit this grade.');
    }
  });

  const revisionMutation = useMutation({
    mutationFn: ({ id, teacher_feedback, currentStatus }) => {
      // VERIFY ACCESS before mutation
      if (!canAccess) {
        throw new Error('FORBIDDEN: Cannot request revision on this homework');
      }
      const normalized = normalizeHomeworkSubmissionStatus(currentStatus);
      // Prevent duplicate revision requests
      if (normalized === HOMEWORK_STATUS.REVISION_REQUIRED) {
        throw new Error('ALREADY_REVISION_REQUIRED');
      }
      return base44.entities.HomeworkSubmission.update(id, { 
        status: HOMEWORK_STATUS.REVISION_REQUIRED,
        teacher_feedback,
        revision_requested_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-submissions', homework.id] });
      setRevisionId(null); setFeedback('');
    },
    onError: (error) => {
      if (error.message === 'ALREADY_REVISION_REQUIRED') {
        alert('Revision already requested. Awaiting student resubmission.');
      } else if (error.message?.includes('FORBIDDEN')) {
        alert('You do not have permission to request revision on this homework.');
      }
    }
  });

  // Build latest submission map with latest timestamp per student
  const latestMap = new Map();
  submissions.forEach((sub) => {
    const key = sub.student_id;
    const current = latestMap.get(key);

    // Determine timestamp for comparison
    const subTimestamp = new Date(sub.submitted_at || sub.updated_at || 0).getTime();
    const currentTimestamp = current ? new Date(current.submitted_at || current.updated_at || 0).getTime() : 0;

    // Keep latest by timestamp
    if (!current || subTimestamp > currentTimestamp) {
      latestMap.set(key, {
        ...sub,
        status: normalizeHomeworkSubmissionStatus(sub.status)
      });
    }
  });

  // Get counts from latest submission per student
  const latestStatuses = Array.from(latestMap.values());
  const submitted = latestStatuses.filter(s => 
    s.status === HOMEWORK_STATUS.SUBMITTED || s.status === HOMEWORK_STATUS.RESUBMITTED
  ).length;
  const graded = latestStatuses.filter(s => s.status === HOMEWORK_STATUS.GRADED).length;
  const revisionRequired = latestStatuses.filter(s => s.status === HOMEWORK_STATUS.REVISION_REQUIRED).length;
  const lateCount = latestStatuses.filter(s => s.is_late).length;

  // Total assigned students = actual count of active students in this class/section
  const totalStudents = assignedStudents.length;

  // Pending = assigned students - students who submitted at least once
  const totalUniqueSubmitted = latestMap.size;
  const pending = Math.max(0, totalStudents - totalUniqueSubmitted);

  // Calculate marks statistics (GRADED submissions only with teacher_marks)
  const { averageMarks, highestMarks, lowestMarks } = getMarksStatistics(submissions);

  return (
   <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" style={{ paddingBottom: '64px' }}>
     <div className="bg-white w-full max-w-2xl rounded-t-3xl overflow-y-auto" style={{ maxHeight: 'calc(100vh - 64px)' }}>
       <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-3 flex items-center justify-between border-b">
         <div>
           <h2 className="font-bold text-slate-800 text-sm">{homework.title}</h2>
           <p className="text-xs text-gray-500">{homework.subject} • Class {homework.class_name}</p>
         </div>
         <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
       </div>

       <div className="p-4 space-y-4">
         {/* Detailed Analytics Header */}
         <HomeworkDetailAnalyticsHeader
           totalAssigned={totalStudents}
           submitted={submitted}
           pending={pending}
           graded={graded}
           revisionRequired={revisionRequired}
           lateCount={lateCount}
           averageMarks={averageMarks}
           highestMarks={highestMarks}
           lowestMarks={lowestMarks}
         />

         {/* Student Progress Segmentation Toggle */}
         <div className="text-center">
           <button
             onClick={() => setShowSegmentation(!showSegmentation)}
             className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 underline"
           >
             {showSegmentation ? 'Hide' : 'Show'} Student Progress by Status
           </button>
         </div>

         {/* Student Progress Segmentation */}
         {showSegmentation && (
           <StudentProgressSegmentation
             submissions={submissions}
             assignedStudents={assignedStudents}
           />
         )}

          {submissionsLoading ? (
            <div className="text-center py-8 text-gray-400">Loading submissions...</div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No submissions yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map(sub => (
                <div key={sub.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{sub.student_name}</p>
                      <p className="text-xs text-gray-500">ID: {sub.student_id}</p>
                      {sub.submitted_at && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Submitted: {format(new Date(sub.submitted_at), 'dd MMM, hh:mm a')}
                          {sub.is_late && <span className="ml-1 text-red-500 font-medium">• Late</span>}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        sub.status === HOMEWORK_STATUS.GRADED ? 'bg-green-100 text-green-700' :
                        sub.status === HOMEWORK_STATUS.REVISION_REQUIRED ? 'bg-orange-100 text-orange-700' :
                        sub.status === HOMEWORK_STATUS.RESUBMITTED ? 'bg-blue-100 text-blue-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                         {sub.status === HOMEWORK_STATUS.REVISION_REQUIRED ? 'Revision' : sub.status}
                       </span>
                      {sub.attempt_no && (
                        <span className="text-[9px] text-gray-500 font-medium">Attempt {sub.attempt_no}</span>
                      )}
                    </div>
                  </div>

                  {/* MCQ Score */}
                  {homework.homework_type === 'MCQ' && sub.mcq_score !== undefined && (
                    <div className="mt-2 text-xs text-purple-700 font-medium">
                      MCQ Score: {sub.mcq_score}/{sub.mcq_total}
                    </div>
                  )}

                  {/* Descriptive Answers */}
                  {homework.homework_type === 'Descriptive' && sub.descriptive_answers?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {sub.descriptive_answers.map((a, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-2 text-xs">
                          <p className="font-medium text-gray-600">Q{idx + 1}: {homework.descriptive_questions?.[idx]?.question}</p>
                          <p className="text-gray-800 mt-0.5">{a.answer}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* File submissions */}
                  {sub.file_urls?.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {sub.file_urls.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                          <FileText className="h-3 w-3" /> File {idx + 1}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Teacher feedback */}
                  {(sub.status === HOMEWORK_STATUS.GRADED || sub.status === HOMEWORK_STATUS.REVISION_REQUIRED) && editGradeId !== sub.id && (
                    <div className={`mt-2 rounded-lg p-2 text-xs ${sub.status === HOMEWORK_STATUS.GRADED ? 'bg-green-50' : 'bg-orange-50'}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          {sub.status === HOMEWORK_STATUS.GRADED && (
                            <p className="font-medium text-green-700">
                              Marks: {sub.teacher_marks}/{homework.max_marks || '—'}
                              {sub.updated_at && sub.graded_at && sub.updated_at !== sub.graded_at && (
                                <span className="ml-2 text-[9px] bg-amber-100 text-amber-700 font-semibold px-1.5 py-0.5 rounded-full">Edited</span>
                              )}
                            </p>
                          )}
                          {sub.teacher_feedback && (
                            <p className={`mt-0.5 ${sub.status === HOMEWORK_STATUS.GRADED ? 'text-green-600' : 'text-orange-600'}`}>
                              {sub.teacher_feedback}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setEditGradeId(sub.id);
                            setMarks(sub.teacher_marks ?? '');
                            setFeedback(sub.teacher_feedback || '');
                            setEditStatus(sub.status === HOMEWORK_STATUS.REVISION_REQUIRED ? HOMEWORK_STATUS.REVISION_REQUIRED : HOMEWORK_STATUS.GRADED);
                            setGradingId(null); setRevisionId(null);
                          }}
                          className="ml-2 flex-shrink-0 text-[10px] text-gray-400 hover:text-indigo-600 flex items-center gap-0.5 font-medium"
                          title="Edit grade"
                        >
                          <Pencil className="h-3 w-3" /> Edit
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  {sub.status !== HOMEWORK_STATUS.GRADED && gradingId !== sub.id && revisionId !== sub.id && (
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => { setGradingId(sub.id); setMarks(sub.teacher_marks || ''); setFeedback(sub.teacher_feedback || ''); }}
                        className="text-xs text-[#1a237e] font-medium flex items-center gap-1 flex-1 justify-center"
                      >
                        <CheckCircle className="h-3 w-3" /> Grade
                      </button>
                      <button
                        onClick={() => { setRevisionId(sub.id); setFeedback(sub.teacher_feedback || ''); }}
                        disabled={sub.status === HOMEWORK_STATUS.REVISION_REQUIRED}
                        className="text-xs text-orange-700 font-medium flex items-center gap-1 flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        ↻ Revision
                      </button>
                    </div>
                  )}

                  {gradingId === sub.id && (
                    <div className="mt-2 space-y-2">
                      <input type="number" min="0" max={homework.max_marks || undefined}
                        placeholder={`Marks (max: ${homework.max_marks || '—'})`}
                        value={marks}
                        onChange={e => {
                          const v = Number(e.target.value);
                          if (homework.max_marks && v > Number(homework.max_marks)) return;
                          setMarks(e.target.value);
                        }}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                      <textarea placeholder="Feedback (optional)" value={feedback} onChange={e => setFeedback(e.target.value)} rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                      <div className="flex gap-2">
                        <button onClick={() => setGradingId(null)} className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5">Cancel</button>
                        <button onClick={() => gradeMutation.mutate({ id: sub.id, teacher_marks: marks, teacher_feedback: feedback })}
                          className="flex-1 text-xs text-white bg-green-600 rounded-lg py-1.5 font-medium">Grade</button>
                      </div>
                    </div>
                  )}

                  {revisionId === sub.id && (
                    <div className="mt-2 space-y-2">
                      <textarea placeholder="Feedback: describe what needs correction (required)" value={feedback} onChange={e => setFeedback(e.target.value)} rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                      <div className="flex gap-2">
                        <button onClick={() => setRevisionId(null)} className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5">Cancel</button>
                        <button onClick={() => revisionMutation.mutate({ id: sub.id, teacher_feedback: feedback, currentStatus: sub.status })}
                            disabled={!feedback.trim()}
                            className="flex-1 text-xs text-white bg-orange-600 rounded-lg py-1.5 font-medium disabled:opacity-50">Request Revision</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}