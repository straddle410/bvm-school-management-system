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

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="min-w-full">
        {/* Header */}
        <div className="flex bg-slate-100 border-b sticky top-0 z-10">
          <div className="w-12 px-3 py-3 flex items-center text-xs font-semibold text-slate-600">Roll</div>
          <div className="w-40 px-4 py-3 flex items-center text-xs font-semibold text-slate-600">Name</div>
          {subjects.map(subject => (
            <div key={subject} className="w-24 px-2 py-3 text-center text-xs font-semibold text-slate-600 border-l">
              <div className="truncate">{subject}</div>
              <div className="text-[10px] font-normal text-slate-500">/{maxMarks}</div>
            </div>
          ))}
        </div>

        {/* Student Rows */}
        <div className="divide-y">
          {students.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">
              No students found
            </div>
          ) : (
            students.map((student, index) => {
              const studentId = student.student_id || student.id;
              return (
                <div key={studentId} className="flex hover:bg-slate-50">
                  <div className="w-12 px-3 py-3 text-xs text-slate-500 flex items-center">
                    {student.roll_no || index + 1}
                  </div>
                  <div className="w-40 px-4 py-3 flex items-center gap-2 text-sm">
                    <Avatar className="h-7 w-7 flex-shrink-0">
                      <AvatarImage src={student.photo_url} />
                      <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                        {student.name?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-900 truncate">{student.name}</p>
                      <p className="text-[10px] text-slate-400">{student.student_id}</p>
                    </div>
                  </div>
                  {subjects.map(subject => {
                    const marks = marksData[studentId]?.[subject]?.marks_obtained;
                    const status = getMarkStatus(marks);
                    
                    return (
                      <div
                        key={subject}
                        className={`w-24 px-2 py-3 flex items-center justify-center border-l ${
                          status === 'pass' ? 'bg-green-50' : status === 'fail' ? 'bg-red-50' : ''
                        }`}
                      >
                        <Input
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max={maxMarks}
                          step="0.5"
                          value={marks ?? ''}
                          onChange={(e) => onMarkChange(studentId, subject, e.target.value)}
                          className={`w-16 h-8 text-center text-xs px-2 ${
                            status === 'pass' ? 'border-green-300' : status === 'fail' ? 'border-red-300' : ''
                          }`}
                          placeholder="0"
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}