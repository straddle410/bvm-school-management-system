import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, CheckCircle, Send } from 'lucide-react';
import { format } from 'date-fns';

export default function HomeworkTakeModal({ homework, student, existingSubmission, onClose }) {
  const hw = homework;
  const qc = useQueryClient();
  const isSubmitted = !!existingSubmission;
  const isGraded = existingSubmission?.status === 'Graded';

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
      return base44.entities.HomeworkSubmission.create({
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
        status: 'Submitted',
      });
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
      <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
        <div className="bg-white w-full max-w-md rounded-t-3xl p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">Submitted!</h2>
          {hw.homework_type === 'MCQ' && score !== null && (
            <p className="text-gray-600 mb-2">Your MCQ Score: <strong>{score}/{hw.mcq_questions?.length}</strong></p>
          )}
          <p className="text-gray-400 text-sm mb-6">Your homework has been submitted successfully.</p>
          <button onClick={onClose} className="w-full bg-[#1a237e] text-white rounded-xl py-3 font-semibold">Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[95vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-3 flex items-center justify-between border-b">
          <div>
            <h2 className="font-bold text-slate-800 text-sm">{hw.title}</h2>
            <p className="text-xs text-gray-500">{hw.subject} • Class {hw.class_name}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="p-4 pb-10 space-y-5">
          {/* Info */}
          {hw.description && (
            <div className="bg-blue-50 rounded-xl p-3">
              <p className="text-sm text-blue-800 font-medium mb-1">Instructions</p>
              <p className="text-xs text-blue-700">{hw.description}</p>
            </div>
          )}
          {hw.due_date && (
            <p className="text-xs text-gray-500 flex items-center gap-1">📅 Due: {format(new Date(hw.due_date), 'dd MMM yyyy')}</p>
          )}
          {hw.attachment_url && (
            <a href={hw.attachment_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline">📎 View Attachment</a>
          )}

          {/* MCQ */}
          {hw.homework_type === 'MCQ' && hw.mcq_questions?.map((q, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-800 mb-3">Q{i + 1}. {q.question}</p>
              {['A','B','C','D'].map(opt => {
                const val = q[`option_${opt.toLowerCase()}`];
                if (!val) return null;
                const selected = mcqAnswers[i]?.selected_option === opt;
                const showCorrect = isSubmitted && opt === q.correct_answer;
                const showWrong = isSubmitted && selected && opt !== q.correct_answer;
                return (
                  <button
                    key={opt}
                    onClick={() => !isSubmitted && setMcqAnswer(i, opt)}
                    disabled={isSubmitted}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl mb-2 text-left text-sm transition-all border-2 ${
                      showCorrect ? 'bg-green-100 border-green-400 text-green-800' :
                      showWrong ? 'bg-red-100 border-red-400 text-red-800' :
                      selected ? 'bg-[#e8eaf6] border-[#1a237e] text-[#1a237e]' :
                      'bg-white border-gray-200 text-gray-700'
                    }`}
                  >
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      selected ? 'bg-[#1a237e] text-white' : 'bg-gray-200 text-gray-600'
                    }`}>{opt}</span>
                    {val}
                  </button>
                );
              })}
            </div>
          ))}

          {/* Descriptive */}
          {hw.homework_type === 'Descriptive' && hw.descriptive_questions?.map((q, i) => (
            <div key={i} className="bg-gray-50 rounded-xl p-4">
              <p className="text-sm font-semibold text-slate-800 mb-2">Q{i + 1}. {q.question}</p>
              {isSubmitted ? (
                <div className="bg-white rounded-lg p-3 text-sm text-gray-700 border border-gray-100">
                  {existingSubmission?.descriptive_answers?.[i]?.answer || '(No answer provided)'}
                </div>
              ) : (
                <textarea
                  rows={4}
                  placeholder="Write your answer here..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
                  value={descAnswers[i]?.answer || ''}
                  onChange={e => setDescAnswer(i, e.target.value)}
                />
              )}
            </div>
          ))}

          {/* Project/Assignment File Upload */}
          {(hw.homework_type === 'Project' || hw.homework_type === 'Assignment' || hw.homework_type === 'Other') && (
            <div>
              <p className="text-sm font-semibold text-slate-800 mb-2">Upload Files</p>
              {!isSubmitted && (
                <label className="flex items-center gap-2 border-2 border-dashed border-gray-300 rounded-xl px-4 py-4 cursor-pointer hover:bg-gray-50 text-sm text-gray-500">
                  <Upload className="h-5 w-5" />
                  {uploading ? 'Uploading...' : 'Tap to upload PDF, images or documents'}
                  <input type="file" className="hidden" multiple accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={handleFileUpload} disabled={uploading} />
                </label>
              )}
              {fileUrls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {fileUrls.map((url, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                      📄 <a href={url} target="_blank" rel="noopener noreferrer" className="underline">File {idx + 1}</a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Graded info */}
          {isGraded && (
            <div className="bg-green-50 rounded-xl p-4">
              <p className="text-sm font-bold text-green-700 mb-1">✅ Graded</p>
              <p className="text-sm text-green-700">Marks: <strong>{existingSubmission.teacher_marks}</strong>{hw.max_marks ? `/${hw.max_marks}` : ''}</p>
              {existingSubmission.teacher_feedback && <p className="text-xs text-green-600 mt-1">💬 {existingSubmission.teacher_feedback}</p>}
            </div>
          )}

          {/* Submit button */}
          {!isSubmitted && (
            <button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="w-full bg-[#1a237e] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-[#283593] transition-colors"
            >
              {submitMutation.isPending ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Send className="h-4 w-4" /> Submit Homework</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}