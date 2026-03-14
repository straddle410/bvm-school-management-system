import React, { useMemo } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, CardContent } from '@/components/ui/card';

const StudentRow = ({ index, style, data }) => {
  const { students, onSelect } = data;
  const s = students[index];

  return (
    <div style={style}>
      <Card className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow mx-2 my-1" onClick={() => onSelect(s)}>
        <CardContent className="p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 font-bold text-sm">{s.name?.[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-semibold text-slate-900">{s.name}</p>
            <p className="text-xs text-slate-500">{s.student_id} · Roll {s.roll_no}</p>
          </div>
          <span className="text-xs text-slate-400">→</span>
        </CardContent>
      </Card>
    </div>
  );
};

export default function StudentListVirtual({ students, onSelect }) {
  const itemData = useMemo(() => ({ students, onSelect }), [students, onSelect]);

  if (students.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-slate-400">No students found</CardContent>
      </Card>
    );
  }

  return (
    <List
      height={400}
      itemCount={students.length}
      itemSize={76}
      width="100%"
      itemData={itemData}
    >
      {StudentRow}
    </List>
  );
}