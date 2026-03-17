import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

export default function StudentListVirtual({ students, onSelect }) {
  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-400">No students found</CardContent>
      </Card>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto space-y-1 pr-2">
      {students.map((student) => (
        <Card 
          key={student.id}
          className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" 
          onClick={() => onSelect(student)}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-700 font-bold text-sm">{student.name?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold text-slate-900">{student.name}</p>
              <p className="text-xs text-slate-500">{student.student_id} · Roll {student.roll_no}</p>
            </div>
            <span className="text-xs text-slate-400">→</span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}