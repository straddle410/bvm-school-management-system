import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Download, CheckCircle, Clock, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function HomeworkSubmissions({ homework, onClose }) {
  const [gradingId, setGradingId] = useState(null);
  const [marks, setMarks] = useState('');
  const [feedback, setFeedback] = useState('');
  const qc = useQueryClient();

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ['hw-submissions', homework.id],
    queryFn: () => base44.entities.HomeworkSubmission.filter({ homework_id: homework.id }, '-created_date', 200),
  });

  const gradeMutation = useMutation({
    mutationFn: ({ id, teacher_marks, teacher_feedback }) =>
      base44.entities.HomeworkSubmission.update(id, { teacher_marks: Number(teacher_marks), teacher_feedback, status: 'Graded' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hw-submissions', homework.id] });
      setGradingId(null); setMarks(''); setFeedback('');
    }
  });

  const submitted = submissions.length;
  const graded = submissions.filter(s => s.status === 'Graded').length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center">
      <div className="bg-white w-full max-w-md rounded-t-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 px-4 pt-4 pb-3 flex items-center justify-between border-b">
          <div>
            <h2 className="font-bold text-slate-800 text-sm">{homework.title}</h2>
            <p className="text-xs text-gray-500">{homework.subject} • Class {homework.class_name}</p>
          </div>
          <button onClick={onClose}><X className="h-5 w-5 text-gray-400" /></button>
        </div>

        <div className="p-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-blue-700">{submitted}</p>
              <p className="text-[10px] text-blue-600">Submitted</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-700">{graded}</p>
              <p className="text-[10px] text-green-600">Graded</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-700">{submitted - graded}</p>
              <p className="text-[10px] text-amber-600">Pending</p>
            </div>
          </div>

          {isLoading ? (
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
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${sub.status === 'Graded' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {sub.status}
                    </span>
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
                  {sub.status === 'Graded' && (
                    <div className="mt-2 bg-green-50 rounded-lg p-2 text-xs">
                      <p className="font-medium text-green-700">Marks: {sub.teacher_marks}/{homework.max_marks || '—'}</p>
                      {sub.teacher_feedback && <p className="text-green-600 mt-0.5">{sub.teacher_feedback}</p>}
                    </div>
                  )}

                  {/* Grade button */}
                  {sub.status !== 'Graded' && gradingId !== sub.id && (
                    <button
                      onClick={() => { setGradingId(sub.id); setMarks(sub.teacher_marks || ''); setFeedback(sub.teacher_feedback || ''); }}
                      className="mt-2 text-xs text-[#1a237e] font-medium flex items-center gap-1"
                    >
                      <CheckCircle className="h-3 w-3" /> Grade Submission
                    </button>
                  )}

                  {gradingId === sub.id && (
                    <div className="mt-2 space-y-2">
                      <input type="number" placeholder={`Marks (max: ${homework.max_marks || '—'})`} value={marks} onChange={e => setMarks(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                      <textarea placeholder="Feedback (optional)" value={feedback} onChange={e => setFeedback(e.target.value)} rows={2}
                        className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
                      <div className="flex gap-2">
                        <button onClick={() => setGradingId(null)} className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-lg py-1.5">Cancel</button>
                        <button onClick={() => gradeMutation.mutate({ id: sub.id, teacher_marks: marks, teacher_feedback: feedback })}
                          className="flex-1 text-xs text-white bg-[#1a237e] rounded-lg py-1.5 font-medium">Save Grade</button>
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