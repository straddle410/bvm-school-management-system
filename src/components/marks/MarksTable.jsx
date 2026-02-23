import React from 'react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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

  return (
    <div className="space-y-3">
      {sortedStudents.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-sm border rounded-lg">
          No students found
        </div>
      ) : (
        <>
          {sortedStudents.map((student) => {
            const studentId = student.student_id || student.id;
            return (
              <div key={studentId} className="bg-white border rounded-lg p-4 hover:shadow-md transition">
                <div className="grid grid-cols-12 gap-3 items-start">
                  {/* Student Info */}
                  <div className="col-span-3 flex items-center gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarImage src={student.photo_url} />
                      <AvatarFallback className="bg-blue-100 text-blue-700 font-semibold">
                        {student.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                          Roll {student.roll_no}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{student.student_id}</p>
                    </div>
                  </div>

                  {/* Marks Inputs */}
                  <div className="col-span-9 grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(subjects.length, 6)}, minmax(0, 1fr))` }}>
                    {subjects.map(subject => {
                      const marks = marksData[studentId]?.[subject]?.marks_obtained;
                      const status = getMarkStatus(marks);
                      
                      return (
                        <div key={subject} className="flex flex-col gap-1">
                          <label className="text-xs font-medium text-slate-600">{subject}</label>
                          <div className={`flex items-center justify-center rounded-lg p-1 ${
                            status === 'pass' ? 'bg-green-50' : status === 'fail' ? 'bg-red-50' : 'bg-slate-50'
                          }`}>
                            <Input
                              type="number"
                              inputMode="decimal"
                              min="0"
                              max={maxMarks}
                              step="0.5"
                              value={marks ?? ''}
                              onChange={(e) => onMarkChange(studentId, subject, e.target.value)}
                              className={`w-full text-center text-sm font-medium border-0 bg-transparent px-2 py-2 ${
                                status === 'pass' ? 'text-green-700' : status === 'fail' ? 'text-red-700' : 'text-slate-700'
                              }`}
                              placeholder="—"
                            />
                          </div>
                          <p className="text-xs text-slate-500 text-center">/{maxMarks}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}