import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, CheckCircle, Send, Calendar, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { HOMEWORK_STATUS, normalizeHomeworkSubmissionStatus, canResubmitHomework, isHomeworkStatusFinal } from '@/components/utils/homeworkStatusHelper';

export default function HomeworkTakeModal({ homework, student, existingSubmission, onClose }) {
  const hw = homework;
  const qc = useQueryClient();
  const submissionStatus = normalizeHomeworkSubmissionStatus(existingSubmission?.status);
  const isSubmitted = !!existingSubmission;
  const isGraded = isHomeworkStatusFinal(submissionStatus);
  const isRevisionRequired = submissionStatus === HOMEWORK_STATUS.REVISION_REQUIRED;
  const isViewOnly = hw.submission_mode === 'VIEW_ONLY';
  const canResubmit = canResubmitHomework(submissionStatus);

  const [mcqAnswers, setMcqAnswers] = useState(
    existingSubmission?.mcq_answers || hw.mcq_questions?.map((_, i) => ({ question_index: i, selected_option: '' })) || []
  );
  const [descAnswers, setDescAnswers] = useState(
    existingSubmission?.descriptive_answers || hw.descriptive_questions?.map((_, i) => ({ question_index: i, answer: '' })) || []
  );
  const [fileUrls, setFileUrls] = useState(existingSubmission?.file_urls || []);
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const isLate = hw.due_date && new Date(hw.due_date) < new Date();
      let mcq_score, mcq_total;
      if (hw.homework_type === 'MCQ' && hw.mcq_questions?.length) {
        mcq_total = hw.mcq_questions.length;
        mcq_score = mcqAnswers.filter((a, i) => a.selected_option === hw.mcq_questions[i]?.correct_answer).length;
      }
      const res = await base44.functions.invoke('submitHomework', {
        student_id: student.student_id,
        submission: {
          homework_id: hw.id,
          student_id: student.student_id,
          student_name: student.name,
          class_name: student.class_name,
          section: student.section,
          homework_type: hw.homework_type,
          mcq_answers: mcqAnswers,
          descriptive_answers: descAnswers,
          file_urls: fileUrls,
          submitted_at: new Date().toISOString(),
          is_late: isLate,
          mcq_score,
          mcq_total,
          status: HOMEWORK_STATUS.SUBMITTED,
        }
      });
      if (res.data?.error) throw new Error(res.data.error);
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['student-submissions'] });
      setSubmitted(true);
    }
  });

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFileUrls(prev => [...prev, file_url]);
    }
    setUploading(false);
  };

  const setMcqAnswer = (i, val) => {
    const updated = [...mcqAnswers];
    updated[i] = { question_index: i, selected_option: val };
    setMcqAnswers(updated);
  };

  const setDescAnswer = (i, val) => {
    const updated = [...descAnswers];
    updated[i] = { question_index: i, answer: val };
    setDescAnswers(updated);
  };

  if (submitted) {
    const score = hw.homework_type === 'MCQ'
      ? mcqAnswers.filter((a, i) => a.selected_option === hw.mcq_questions?.[i]?.correct_answer).length
      : null;
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center" style={{ overscrollBehavior: 'contain' }}>
        <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl" style={{ maxHeight: 'calc(100vh - 80px)', minHeight: '50vh' }}>
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 text-center flex flex-col items-center justify-center" style={{ WebkitOverflowScrolling: 'touch' }}>
            <CheckCircle className="h-20 w-20 text-green-500 mb-4" />
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-3">Submitted!</h2>
            {hw.homework_type === 'MCQ' && score !== null && (
              <p className="text-lg text-gray-700 mb-2">Your MCQ Score: <strong className="text-xl">{score}/{hw.mcq_questions?.length}</strong></p>
            )}
            <p className="text-gray-500 text-base mb-8">Your homework has been submitted successfully.</p>
            <button onClick={onClose} className="w-full sm:w-auto bg-[#1a237e] text-white rounded-xl py-3 px-8 font-semibold text-lg">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center" style={{ overscrollBehavior: 'contain' }}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl flex flex-col shadow-2xl" style={{ maxHeight: 'calc(100vh - 80px)' }}>
        {/* STICKY HEADER */}
        <div className="bg-white px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-gray-100 flex-shrink-0 sticky top-0 z-10">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1">
              <h2 className="font-bold text-slate-900 text-lg sm:text-xl leading-snug">{hw.title}</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">{hw.subject} • Class {hw.class_name}{hw.section && hw.section !== 'All' ? ` ${hw.section}` : ''}</p>
            </div>
            <button onClick={onClose} className="flex-shrink-0 text-gray-400 hover:text-gray-600 p-1">
              <X className="h-6 w-6" />
            </button>
          </div>
          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
              isViewOnly ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {isViewOnly ? '👁 View Only' : '📝 Submission Required'}
            </span>
            {isSubmitted && !isRevisionRequired && !isGraded && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-blue-100 text-blue-700">
                ✓ Submitted (Attempt {existingSubmission.attempt_no || 1})
              </span>
            )}
            {isRevisionRequired && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-100 text-orange-700">
                ⚠ Revision Required
              </span>
            )}
            {isGraded && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-100 text-green-700">
                ⭐ Graded: {existingSubmission.teacher_marks}{hw.max_marks ? `/${hw.max_marks}` : ''}
              </span>
            )}
            {existingSubmission?.is_late && (
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-red-100 text-red-700">
                Late
              </span>
            )}
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-6 space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Info Section */}
          <div>
            {/* Due Date */}
            {hw.due_date && (
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="h-5 w-5 text-[#1a237e] flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500 font-medium">Due Date</p>
                  <p className="text-sm font-semibold text-slate-800">{format(new Date(hw.due_date), 'dd MMM yyyy')}</p>
                </div>
              </div>
            )}

            {/* Instructions */}
            {hw.description && (
              <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
                <p className="text-xs font-semibold text-blue-900 mb-2">📋 Instructions</p>
                <p className="text-sm text-blue-800 leading-relaxed">{hw.description}</p>
              </div>
            )}
          </div>

          {/* Attachment */}
          {hw.attachment_url && (
            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
              <p className="text-xs font-semibold text-amber-900 mb-2">📎 Attachment</p>
              <a href={hw.attachment_url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#1a237e] underline">
                Download File
              </a>
            </div>
          )}

          {/* MCQ Questions */}
          {hw.homework_type === 'MCQ' && hw.mcq_questions?.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 text-base">Questions</h3>
              {hw.mcq_questions.map((q, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-slate-800 mb-4">Q{i + 1}. {q.question}</p>
                  <div className="space-y-2">
                    {['A','B','C','D'].map(opt => {
                      const val = q[`option_${opt.toLowerCase()}`];
                      if (!val) return null;
                      const selected = mcqAnswers[i]?.selected_option === opt;
                      const showCorrect = isGraded && opt === q.correct_answer;
                      const showWrong = isGraded && selected && opt !== q.correct_answer;
                      return (
                        <button
                          key={opt}
                          onClick={() => !isSubmitted && setMcqAnswer(i, opt)}
                          disabled={isSubmitted}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left text-sm transition-all border-2 ${
                            showCorrect ? 'bg-green-100 border-green-400 text-green-800' :
                            showWrong ? 'bg-red-100 border-red-400 text-red-800' :
                            selected ? 'bg-[#e8eaf6] border-[#1a237e] text-[#1a237e]' :
                            'bg-white border-gray-300 text-gray-700 hover:border-gray-400'
                          }`}
                        >
                          <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                            selected ? 'bg-[#1a237e] text-white' : 'bg-gray-300 text-gray-600'
                          }`}>{opt}</span>
                          <span className="text-sm">{val}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Descriptive Questions */}
          {hw.homework_type === 'Descriptive' && hw.descriptive_questions?.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 text-base">Questions</h3>
              {hw.descriptive_questions.map((q, i) => (
                <div key={i} className="bg-slate-50 rounded-2xl p-4 border border-gray-200">
                  <p className="text-sm font-semibold text-slate-800 mb-3">Q{i + 1}. {q.question}</p>
                  {isSubmitted ? (
                    <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border border-gray-200 max-h-32 overflow-y-auto">
                      {existingSubmission?.descriptive_answers?.[i]?.answer || '(No answer provided)'}
                    </div>
                  ) : (
                    <textarea
                      rows={4}
                      placeholder="Write your answer here..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#1a237e] focus:border-transparent"
                      value={descAnswers[i]?.answer || ''}
                      onChange={e => setDescAnswer(i, e.target.value)}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* File Upload */}
          {(hw.homework_type === 'Project' || hw.homework_type === 'Assignment' || hw.homework_type === 'Other') && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-900 text-base">Submission Files</h3>
              {!isViewOnly && !isSubmitted && (
                <label className="flex items-center justify-center gap-3 border-2 border-dashed border-gray-400 rounded-2xl px-4 py-6 cursor-pointer hover:bg-gray-50 transition-colors">
                  <Upload className="h-5 w-5 text-gray-500" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">{uploading ? 'Uploading...' : 'Upload Files'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">PDF, Images, or Documents</p>
                  </div>
                  <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading} />
                </label>
              )}
              {fileUrls.length > 0 && (
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 space-y-2">
                  {fileUrls.map((url, idx) => (
                    <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-[#1a237e] font-semibold hover:underline">
                      📄 File {idx + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback */}
          {isRevisionRequired && existingSubmission.teacher_feedback && (
            <div className="bg-orange-50 rounded-2xl p-4 border border-orange-200">
              <p className="text-xs font-semibold text-orange-900 mb-2">⚠ Revision Requested</p>
              <p className="text-sm text-orange-800 leading-relaxed">{existingSubmission.teacher_feedback}</p>
            </div>
          )}
          {isGraded && existingSubmission.teacher_feedback && (
            <div className="bg-green-50 rounded-2xl p-4 border border-green-200">
              <p className="text-xs font-semibold text-green-900 mb-2">💬 Teacher Feedback</p>
              <p className="text-sm text-green-800 leading-relaxed">{existingSubmission.teacher_feedback}</p>
            </div>
          )}

          </div>

          {/* STICKY FOOTER */}
          <div className="bg-white border-t border-gray-100 px-5 sm:px-6 py-4 flex-shrink-0 sticky bottom-0">
          {isViewOnly ? (
            <button
              onClick={onClose}
              className="w-full bg-gray-200 text-gray-700 py-3 px-4 rounded-xl font-semibold text-base hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          ) : isGraded ? (
            <button
              onClick={onClose}
              className="w-full bg-green-600 text-white py-3 px-4 rounded-xl font-semibold text-base hover:bg-green-700 transition-colors"
            >
              ✓ Graded
            </button>
          ) : canResubmit ? (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="w-full bg-orange-600 text-white py-3 px-4 rounded-xl font-semibold text-base hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Resubmitting...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Resubmit Homework
                </>
              )}
            </button>
          ) : isSubmitted ? (
            <button
              onClick={onClose}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold text-base hover:bg-blue-700 transition-colors"
            >
              ✓ Submitted
            </button>
          ) : (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="w-full bg-[#1a237e] text-white py-3 px-4 rounded-xl font-semibold text-base hover:bg-[#283593] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitMutation.isPending ? (
                <>
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-5 w-5" />
                  Submit Homework
                </>
              )}
            </button>
          )}
          </div>
          </div>
          </div>
          );
          }