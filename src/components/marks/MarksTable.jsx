import React from 'react';
import { Input } from '@/components/ui/input';

export default function MarksTable({
  students,
  subjects,
  marksData,
  onMarkChange,
  maxMarks,
  passingMarks
}) {
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
    <div className="overflow-x-auto border rounded-lg bg-white w-full">
      <table className="w-full border-collapse text-sm md:text-base">
        <thead>
          <tr className="bg-slate-800 text-white sticky top-0">
            <th className="border border-slate-200 px-2 md:px-4 py-2 md:py-3 text-left font-semibold w-8 md:w-12">Roll</th>
            <th className="border border-slate-200 px-2 md:px-4 py-2 md:py-3 text-left font-semibold">ID</th>
            <th className="border border-slate-200 px-2 md:px-4 py-2 md:py-3 text-left font-semibold">Name</th>
            {subjects.map(subject => (
              <th key={subject} className="border border-slate-200 px-2 md:px-3 py-2 md:py-3 text-center font-semibold bg-slate-700 whitespace-nowrap text-xs md:text-sm">
                {subject}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedStudents.map((student, idx) => {
            const studentId = student.student_id || student.id;
            return (
              <tr key={studentId} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                <td className="border border-slate-200 px-2 md:px-4 py-2 md:py-3 font-medium text-slate-700 text-center">{student.roll_no || '—'}</td>
                <td className="border border-slate-200 px-2 md:px-4 py-2 md:py-3 text-slate-600 text-xs md:text-sm">{student.student_id}</td>
                <td className="border border-slate-200 px-2 md:px-4 py-2 md:py-3 font-medium text-slate-900 text-xs md:text-sm">{student.name}</td>
                {subjects.map((subject, subjectIdx) => {
                  const marks = marksData[studentId]?.[subject]?.marks_obtained;
                  const status = getMarkStatus(marks);

                  return (
                    <td key={subject} className="border border-slate-200 px-2 md:px-3 py-1 md:py-2 text-center">
                      <div className={`flex items-center justify-center rounded p-0.5 md:p-1 ${
                        status === 'pass' ? 'bg-green-100' : status === 'fail' ? 'bg-red-100' : 'bg-slate-100'
                      }`}>
                        <Input
                          id={`marks-${idx}-${subjectIdx}`}
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max={maxMarks}
                          step="0.5"
                          value={marks ?? ''}
                          onChange={(e) => onMarkChange(studentId, subject, e.target.value)}
                          onKeyDown={(e) => handleKeyDown(e, idx, subjectIdx)}
                          className={`w-12 md:w-14 text-center text-xs md:text-sm font-semibold border-0 bg-transparent px-0.5 md:px-1 py-0.5 md:py-1 ${
                            status === 'pass' ? 'text-green-700' : status === 'fail' ? 'text-red-700' : 'text-slate-700'
                          }`}
                          placeholder="—"
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}