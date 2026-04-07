import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function MobileMarksEntry({
  students,
  subjects,
  marksData,
  onMarkChange,
  maxMarks,
  passingMarks,
  isLocked = false,
  examMarksConfig = null
}) {
  const hasInternal = examMarksConfig?.has_internal_marks || false;
  const maxInternal = examMarksConfig?.max_internal_marks || 0;
  const maxExternal = examMarksConfig?.max_external_marks || maxMarks;
  const [currentSubjectIdx, setCurrentSubjectIdx] = useState(0);
  const currentSubject = subjects[currentSubjectIdx];

  const getMarkStatus = (marks) => {
    if (marks === undefined || marks === null) return '';
    const numMarks = parseFloat(marks);
    return numMarks >= passingMarks ? 'pass' : 'fail';
  };

  const sortedStudents = [...students].sort((a, b) => {
    const rollA = a.roll_no || 0;
    const rollB = b.roll_no || 0;
    return rollA - rollB;
  });

  const handleKeyDown = (e, studentIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (studentIdx < sortedStudents.length - 1) {
        const nextInputId = `mobile-marks-${studentIdx + 1}`;
        document.getElementById(nextInputId)?.focus();
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Subject Navigation */}
      <div className="flex items-center gap-2 bg-white p-3 rounded-lg border">
        <button
          onClick={() => setCurrentSubjectIdx(Math.max(0, currentSubjectIdx - 1))}
          disabled={currentSubjectIdx === 0}
          className="p-1 disabled:opacity-40"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        <div className="flex-1 text-center">
          <div className="text-sm font-semibold text-slate-700">{currentSubject}</div>
          <div className="text-xs text-slate-500">{currentSubjectIdx + 1} of {subjects.length}</div>
        </div>

        <button
          onClick={() => setCurrentSubjectIdx(Math.min(subjects.length - 1, currentSubjectIdx + 1))}
          disabled={currentSubjectIdx === subjects.length - 1}
          className="p-1 disabled:opacity-40"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Students List for Current Subject */}
      <div className="space-y-2">
        {sortedStudents.map((student, idx) => {
          const studentId = student.student_id || student.id;
          const marks = marksData[studentId]?.[currentSubject]?.marks_obtained;
          const status = getMarkStatus(marks);

          const internalMarks = marksData[studentId]?.[currentSubject]?.internal_marks_obtained;
          const externalMarks = marksData[studentId]?.[currentSubject]?.external_marks_obtained;

          return (
            <div key={studentId} className="bg-white p-4 rounded-lg border space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-slate-900 text-sm">{student.name}</div>
                  <div className="text-xs text-slate-500">Roll: {student.roll_no || '—'} | ID: {student.student_id}</div>
                </div>
              </div>

              {hasInternal ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-blue-600 w-20">Internal ({maxInternal})</span>
                    <div className="flex-1 bg-blue-50 rounded p-2 flex items-center">
                      <Input
                        type="number" inputMode="decimal" min="0" max={maxInternal} step="0.5"
                        value={internalMarks ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || parseFloat(val) <= maxInternal)
                            onMarkChange?.(studentId, currentSubject, 'internal_marks_obtained', val);
                        }}
                        disabled={isLocked}
                        className="w-full text-center text-lg font-semibold border-0 bg-transparent text-blue-700"
                        placeholder="—"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-600 w-20">External ({maxExternal})</span>
                    <div className={`flex-1 rounded p-2 flex items-center ${
                      status === 'pass' ? 'bg-green-100' : status === 'fail' ? 'bg-red-100' : 'bg-slate-100'
                    }`}>
                      <Input
                        type="number" inputMode="decimal" min="0" max={maxExternal} step="0.5"
                        value={externalMarks ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || parseFloat(val) <= maxExternal)
                            onMarkChange?.(studentId, currentSubject, 'external_marks_obtained', val);
                        }}
                        disabled={isLocked}
                        className={`w-full text-center text-lg font-semibold border-0 bg-transparent ${
                          status === 'pass' ? 'text-green-700' : status === 'fail' ? 'text-red-700' : 'text-slate-700'
                        }`}
                        placeholder="—"
                      />
                    </div>
                  </div>
                  {marks !== undefined && marks !== '' && (
                    <div className="text-center text-xs text-slate-500">Total: <strong>{marks}</strong> / {maxMarks}</div>
                  )}
                </div>
              ) : (
                <div className={`flex items-center rounded p-3 ${
                  status === 'pass' ? 'bg-green-100' : status === 'fail' ? 'bg-red-100' : 'bg-slate-100'
                }`}>
                  <Input
                     id={`mobile-marks-${idx}`}
                     type="number"
                     inputMode="decimal"
                     min="0"
                     max={maxMarks}
                     step="0.5"
                     value={marks ?? ''}
                     onChange={(e) => {
                       const val = e.target.value;
                       if (val === '' || parseFloat(val) <= maxMarks) {
                         onMarkChange?.(studentId, currentSubject, val);
                       }
                     }}
                     onKeyDown={(e) => handleKeyDown(e, idx)}
                     disabled={isLocked}
                     className={`w-full text-center text-lg font-semibold border-0 bg-transparent px-2 py-2 ${
                       status === 'pass' ? 'text-green-700' : status === 'fail' ? 'text-red-700' : 'text-slate-700'
                     } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                     placeholder="Enter marks"
                   />
                  <span className="text-xs font-semibold text-slate-500 ml-2">/{maxMarks}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}