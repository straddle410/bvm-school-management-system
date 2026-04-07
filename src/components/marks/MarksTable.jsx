import React from 'react';
import { Input } from '@/components/ui/input';

export default function MarksTable({
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
  const getMarkStatus = (marks) => {
    if (marks === undefined || marks === null) return '';
    const numMarks = parseFloat(marks);
    return numMarks >= passingMarks ? 'pass' : 'fail';
  };

  // Sort students by roll number
  const sortedStudents = [...students].sort((a, b) => {
    const rollA = a.roll_no || 0;
    const rollB = b.roll_no || 0;
    return rollA - rollB;
  });

  const handleKeyDown = (e, studentIdx, subjectIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Navigate to next student, same subject
      if (studentIdx < sortedStudents.length - 1) {
        const nextInputId = `marks-${studentIdx + 1}-${subjectIdx}`;
        document.getElementById(nextInputId)?.focus();
      }
    }
  };

  if (sortedStudents.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm border rounded-lg">
        No students found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:bg-gray-900 w-full shadow-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wider sticky left-0 bg-slate-800 z-20 w-10">Roll</th>
            <th className="px-3 py-3 text-left font-semibold text-xs uppercase tracking-wider sticky left-10 bg-slate-800 z-20 min-w-[160px]">Student</th>
            {subjects.map(subject => (
              hasInternal ? (
                <th key={subject} colSpan={2} className="px-2 py-2 text-center font-semibold text-xs uppercase tracking-wider bg-slate-700 min-w-[140px]">
                  <div>{subject}</div>
                  <div className="flex justify-center gap-2 mt-1">
                    <span className="text-[10px] font-normal bg-blue-600 text-white px-1.5 py-0.5 rounded">Int /{maxInternal}</span>
                    <span className="text-[10px] font-normal bg-slate-500 text-white px-1.5 py-0.5 rounded">Ext /{maxExternal}</span>
                  </div>
                </th>
              ) : (
                <th key={subject} className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider bg-slate-700 min-w-[100px]">
                  <div>{subject}</div>
                  <div className="text-[10px] font-normal opacity-70 mt-0.5">/{maxMarks}</div>
                </th>
              )
            ))}
            <th className="px-3 py-3 text-center font-semibold text-xs uppercase tracking-wider bg-slate-600 min-w-[80px]">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sortedStudents.map((student, idx) => {
            const studentId = student.student_id || student.id;
            const rowBg = idx % 2 === 0 ? 'bg-white dark:bg-gray-900' : 'bg-slate-50 dark:bg-gray-800';
            return (
              <tr key={studentId} className={`${rowBg} hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors`}>
                <td className={`px-3 py-2 text-center font-bold text-slate-500 text-sm sticky left-0 z-10 ${rowBg}`}>{student.roll_no || '—'}</td>
                <td className={`px-3 py-2 sticky left-10 z-10 ${rowBg}`}>
                  <div className="font-semibold text-slate-900 dark:text-gray-100 text-sm leading-tight">{student.name || student.student_id}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{student.student_id}</div>
                </td>
                {subjects.map((subject, subjectIdx) => {
                  const marks = marksData[studentId]?.[subject]?.marks_obtained;
                  const internalMarks = marksData[studentId]?.[subject]?.internal_marks_obtained;
                  const externalMarks = marksData[studentId]?.[subject]?.external_marks_obtained;
                  const status = getMarkStatus(marks);

                  if (hasInternal) {
                    return (
                      <React.Fragment key={subject}>
                        <td className="px-1 py-2 text-center">
                          <input
                            id={`marks-${idx}-${subjectIdx}-int`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={maxInternal}
                            step="0.5"
                            value={internalMarks ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || parseFloat(val) <= maxInternal)
                                onMarkChange?.(studentId, subject, 'internal_marks_obtained', val);
                            }}
                            disabled={isLocked}
                            placeholder="—"
                            className="w-14 h-9 text-center text-sm font-semibold rounded-lg border-2 border-blue-200 bg-blue-50 text-blue-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                        </td>
                        <td className="px-1 py-2 text-center">
                          <input
                            id={`marks-${idx}-${subjectIdx}-ext`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={maxExternal}
                            step="0.5"
                            value={externalMarks ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || parseFloat(val) <= maxExternal)
                                onMarkChange?.(studentId, subject, 'external_marks_obtained', val);
                            }}
                            disabled={isLocked}
                            placeholder="—"
                            className={`w-14 h-9 text-center text-sm font-semibold rounded-lg border-2 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                              status === 'pass'
                                ? 'border-green-300 bg-green-50 text-green-800 focus:border-green-500 focus:ring-green-200'
                                : status === 'fail'
                                ? 'border-red-300 bg-red-50 text-red-800 focus:border-red-500 focus:ring-red-200'
                                : 'border-slate-200 bg-white text-slate-700 focus:border-indigo-400 focus:ring-indigo-100'
                            }`}
                          />
                        </td>
                      </React.Fragment>
                    );
                  }

                  return (
                    <td key={subject} className="px-2 py-2 text-center">
                      <input
                        id={`marks-${idx}-${subjectIdx}`}
                        type="number"
                        inputMode="decimal"
                        min="0"
                        max={maxMarks}
                        step="0.5"
                        value={marks ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || parseFloat(val) <= maxMarks)
                            onMarkChange?.(studentId, subject, val);
                        }}
                        onKeyDown={(e) => handleKeyDown(e, idx, subjectIdx)}
                        disabled={isLocked}
                        placeholder="—"
                        className={`w-16 h-9 text-center text-sm font-semibold rounded-lg border-2 focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                          status === 'pass'
                            ? 'border-green-300 bg-green-50 text-green-800 focus:border-green-500 focus:ring-green-200'
                            : status === 'fail'
                            ? 'border-red-300 bg-red-50 text-red-800 focus:border-red-500 focus:ring-red-200'
                            : 'border-slate-200 bg-white text-slate-700 focus:border-indigo-400 focus:ring-indigo-100'
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="px-3 py-2 text-center bg-slate-100 dark:bg-gray-700">
                  {(() => {
                    const total = subjects.reduce((sum, subject) => {
                      const m = marksData[studentId]?.[subject]?.marks_obtained;
                      return m !== undefined && m !== '' ? sum + parseFloat(m) : sum;
                    }, 0);
                    const hasAny = subjects.some(subject => {
                      const m = marksData[studentId]?.[subject]?.marks_obtained;
                      return m !== undefined && m !== '';
                    });
                    return (
                      <span className="text-sm font-bold text-slate-800 dark:text-gray-200">
                        {hasAny ? total : '—'}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}