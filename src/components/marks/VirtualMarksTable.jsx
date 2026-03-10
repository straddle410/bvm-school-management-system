import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';

const ROW_HEIGHT = 50;
const PAGE_SIZE = 200; // Load 200 students at a time

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

  // Paginate: only load PAGE_SIZE students at a time
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

  const renderRow = (student, index) => {
    const studentId = student.student_id || student.id;
    const globalIdx = currentPage * PAGE_SIZE + index;

    return (
      <div key={studentId} className={`flex border-b ${index % 2 === 0 ? 'bg-slate-50' : 'bg-white'}`}>
        {/* Roll */}
        <div className="w-12 flex items-center px-2 font-medium text-slate-700 text-xs border-r">
          {student.roll_no || '—'}
        </div>

        {/* ID */}
        <div className="w-20 flex items-center px-2 text-slate-600 text-xs border-r">
          {student.student_id}
        </div>

        {/* Name */}
        <div className="w-40 flex items-center px-2 font-medium text-slate-900 text-xs border-r truncate">
          {student.name}
        </div>

        {/* Marks for each subject */}
        <div className="flex flex-1 overflow-x-auto">
          {subjects.map((subject, subjectIdx) => {
            const marks = marksData[studentId]?.[subject]?.marks_obtained;
            const status = getMarkStatus(marks);

            return (
              <div key={subject} className="w-20 flex-shrink-0 flex items-center justify-center px-1 border-r">
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
                    onKeyDown={(e) => handleKeyDown(e, index, subjectIdx)}
                    disabled={isLocked}
                    className={`w-12 text-center text-xs font-semibold border-0 bg-transparent px-0.5 py-0.5 ${
                      status === 'pass' ? 'text-green-700' : status === 'fail' ? 'text-red-700' : 'text-slate-700'
                    } ${isLocked ? 'opacity-50 cursor-not-allowed' : ''}`}
                    placeholder="—"
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div className="w-16 flex-shrink-0 flex items-center justify-center px-1 bg-slate-100 border-l">
          <span className="text-xs font-bold text-slate-800">
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
        </div>
      </div>
    );
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
      {/* Header */}
      <div className="overflow-x-auto border rounded-lg bg-white">
        <div className="flex bg-slate-800 text-white sticky top-0 z-20">
          <div className="w-12 flex items-center px-2 font-semibold text-xs border-r">Roll</div>
          <div className="w-20 flex items-center px-2 font-semibold text-xs border-r">ID</div>
          <div className="w-40 flex items-center px-2 font-semibold text-xs border-r">Name</div>
          <div className="flex flex-1 overflow-x-auto">
            {subjects.map(subject => (
              <div key={subject} className="w-20 flex-shrink-0 flex items-center justify-center px-1 border-r font-semibold text-xs bg-slate-700">
                {subject}
              </div>
            ))}
          </div>
          <div className="w-16 flex-shrink-0 flex items-center justify-center px-1 font-semibold text-xs bg-slate-600">
            Total
          </div>
        </div>

        {/* Paginated List */}
        <div className="divide-y max-h-[600px] overflow-y-auto">
          {paginatedStudents.map((student, index) => renderRow(student, index))}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 items-center">
          <button
            onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-2 border rounded disabled:opacity-50"
          >
            ← Previous
          </button>
          <span className="text-sm text-slate-600">
            Page {currentPage + 1} of {totalPages} ({paginatedStudents.length} students)
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-2 border rounded disabled:opacity-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}