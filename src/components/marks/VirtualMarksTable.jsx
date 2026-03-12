import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const PAGE_SIZE = 200;

export default function VirtualMarksTable({
  students,
  subjects,
  marksData,
  onMarkChange,
  maxMarks,
  passingMarks,
  isLocked = false
}) {
  const [currentPage, setCurrentPage] = useState(0);

  const sortedStudents = useMemo(() => {
    return [...students].sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0));
  }, [students]);

  const paginatedStudents = useMemo(() => {
    return sortedStudents.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  }, [sortedStudents, currentPage]);

  const getMarkStatus = (marks) => {
    if (marks === undefined || marks === null) return '';
    const numMarks = parseFloat(marks);
    return numMarks >= passingMarks ? 'pass' : 'fail';
  };

  const handleKeyDown = (e, studentIdx, subjectIdx) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const globalIdx = currentPage * PAGE_SIZE + studentIdx;
      if (globalIdx < sortedStudents.length - 1) {
        const nextInputId = `marks-${globalIdx + 1}-${subjectIdx}`;
        document.getElementById(nextInputId)?.focus();
      }
    }
  };

  const totalPages = Math.ceil(sortedStudents.length / PAGE_SIZE);

  if (sortedStudents.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm border rounded-lg">
        No students found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border rounded-lg bg-white dark:bg-gray-900">
        <table className="w-full border-collapse text-sm" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-slate-800 text-white sticky top-0 z-20">
              <th className="border border-slate-200 px-2 py-2 text-left font-semibold w-12 sticky left-0 bg-slate-800">Roll</th>
              <th className="border border-slate-200 px-2 py-2 text-left font-semibold w-16 sticky left-12 bg-slate-800">ID</th>
              <th className="border border-slate-200 px-2 py-2 text-left font-semibold w-32 sticky left-28 bg-slate-800">Name</th>
              {subjects.map(subject => (
                <th key={subject} className="border border-slate-200 px-2 py-2 text-center font-semibold bg-slate-700 whitespace-normal text-xs w-20">
                  {subject}
                </th>
              ))}
              <th className="border border-slate-200 px-2 py-2 text-center font-semibold bg-slate-600 w-16">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((student, idx) => {
              const studentId = student.student_id || student.id;
              const globalIdx = currentPage * PAGE_SIZE + idx;
              return (
                <tr key={studentId} className={idx % 2 === 0 ? 'bg-slate-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}>
                  <td className={`border border-slate-200 px-2 py-2 font-medium text-slate-700 text-center sticky left-0 w-12 ${idx % 2 === 0 ? 'bg-slate-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}`}>
                    {student.roll_no || '—'}
                  </td>
                  <td className={`border border-slate-200 px-2 py-2 text-slate-600 dark:text-gray-400 text-xs sticky left-12 w-16 ${idx % 2 === 0 ? 'bg-slate-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}`}>
                    {student.student_id}
                  </td>
                  <td className={`border border-slate-200 px-2 py-2 font-medium text-slate-900 dark:text-gray-200 text-xs sticky left-28 w-32 truncate ${idx % 2 === 0 ? 'bg-slate-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900'}`}>
                    {student.name || student.student_id}
                  </td>
                  {subjects.map((subject, subjectIdx) => {
                    const marks = marksData[studentId]?.[subject]?.marks_obtained;
                    const status = getMarkStatus(marks);

                    return (
                      <td key={subject} className="border border-slate-200 px-1 py-1 text-center w-20">
                        <div className={`flex items-center justify-center rounded p-0.5 ${
                          status === 'pass' ? 'bg-green-100' : status === 'fail' ? 'bg-red-100' : 'bg-slate-100'
                        }`}>
                          <Input
                            id={`marks-${globalIdx}-${subjectIdx}`}
                            type="number"
                            inputMode="decimal"
                            min="0"
                            max={maxMarks}
                            step="0.5"
                            value={marks ?? ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val === '' || parseFloat(val) <= maxMarks) {
                                onMarkChange?.(studentId, subject, val);
                              }
                            }}
                            onKeyDown={(e) => handleKeyDown(e, idx, subjectIdx)}
                            disabled={isLocked}
                            className={`w-14 text-center text-xs font-semibold border-0 bg-transparent dark:bg-gray-700 px-0.5 py-0.5 ${
                              status === 'pass' ? 'text-green-700 dark:text-green-400' : status === 'fail' ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-gray-300'
                            } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                            placeholder="—"
                          />
                        </div>
                      </td>
                    );
                  })}
                  <td className="border border-slate-200 px-2 py-1 text-center w-16 bg-slate-100 dark:bg-gray-700">
                    <span className="text-xs font-bold text-slate-800 dark:text-gray-200">
                      {(() => {
                        const total = subjects.reduce((sum, subject) => {
                          const m = marksData[studentId]?.[subject]?.marks_obtained;
                          return m !== undefined && m !== '' ? sum + parseFloat(m) : sum;
                        }, 0);
                        const hasAny = subjects.some(subject => {
                          const m = marksData[studentId]?.[subject]?.marks_obtained;
                          return m !== undefined && m !== '';
                        });
                        return hasAny ? total : '—';
                      })()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
          >
            ← Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {currentPage + 1} of {totalPages} ({paginatedStudents.length} of {sortedStudents.length})
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}