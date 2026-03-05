import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, Trophy } from 'lucide-react';
import { createPageUrl } from '@/utils';

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function StudentMarks() {
  const [student, setStudent] = useState(null);

  useEffect(() => {
    const session = getStudentSession();
    if (!session) {
      window.location.href = createPageUrl('StudentLogin');
      return;
    }
    setStudent(session);
  }, []);

  const { data: marks = [], isLoading } = useQuery({
    queryKey: ['student-marks', student?.student_id],
    queryFn: async () => {
      if (!student?.student_id) return [];
      try {
        const records = await base44.entities.Marks.filter({
          student_id: student.student_id,
          academic_year: student.academic_year,
          status: 'Published',
        }, '-created_date', 500);
        return records || [];
      } catch {
        return [];
      }
    },
    enabled: !!student?.student_id,
  });

  if (!student) return null;

  // Group by exam type
  const marksGrouped = marks.reduce((acc, mark) => {
    if (!acc[mark.exam_type]) acc[mark.exam_type] = [];
    acc[mark.exam_type].push(mark);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <h1 className="text-lg font-bold">My Marks</h1>
        <p className="text-sm text-blue-100">View your exam results</p>
      </header>

      <div className="px-4 py-6 space-y-4">
        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : marks.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <BarChart3 className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No marks published yet</p>
          </div>
        ) : (
          Object.entries(marksGrouped).map(([examType, examMarks]) => (
            <div key={examType} className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                <p className="text-sm font-bold text-gray-700">{examType}</p>
              </div>
              <div className="divide-y divide-gray-100">
                {examMarks.map((mark) => (
                  <div key={mark.id} className="px-4 py-3">
                    <div className="flex items-start justify-between mb-1">
                      <p className="text-sm font-semibold text-gray-900">{mark.subject}</p>
                      <div className="text-right">
                        <p className="text-lg font-bold text-indigo-600">
                          {mark.marks_obtained}/{mark.max_marks}
                        </p>
                        {mark.grade && (
                          <p className="text-xs text-gray-500">Grade: {mark.grade}</p>
                        )}
                      </div>
                    </div>
                    {mark.remarks && (
                      <p className="text-xs text-gray-600 mt-1">
                        <span className="font-semibold">Remarks:</span> {mark.remarks}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}