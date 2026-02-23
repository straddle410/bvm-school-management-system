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

  if (sortedStudents.length === 0) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm border rounded-lg">
        No students found
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border rounded-lg bg-white">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-sm w-12">Roll</th>
            <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-sm">Student ID</th>
            <th className="border border-slate-200 px-4 py-3 text-left font-semibold text-sm">Student Name</th>
            {subjects.map(subject => (
              <th key={subject} className="border border-slate-200 px-3 py-3 text-center font-semibold text-sm bg-slate-700 whitespace-nowrap">
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
                <td className="border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">{student.roll_no || '—'}</td>
                <td className="border border-slate-200 px-4 py-3 text-sm text-slate-600">{student.student_id}</td>
                <td className="border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900">{student.name}</td>
                {subjects.map(subject => {
                  const marks = marksData[studentId]?.[subject]?.marks_obtained;
                  const status = getMarkStatus(marks);

                  return (
                    <td key={subject} className="border border-slate-200 px-3 py-2 text-center">
                      <div className={`flex items-center justify-center rounded p-1 ${
                        status === 'pass' ? 'bg-green-100' : status === 'fail' ? 'bg-red-100' : 'bg-slate-100'
                      }`}>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max={maxMarks}
                          step="0.5"
                          value={marks ?? ''}
                          onChange={(e) => onMarkChange(studentId, subject, e.target.value)}
                          className={`w-14 text-center text-sm font-semibold border-0 bg-transparent px-1 py-1 ${
                            status === 'pass' ? 'text-green-700' : status === 'fail' ? 'text-red-700' : 'text-slate-700'
                          }`}
                          placeholder="—"
                        />
                        <span className="text-xs text-slate-500 ml-1">/{maxMarks}</span>
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