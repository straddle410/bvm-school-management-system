import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Trophy } from 'lucide-react';

export default function StudentMarks() {
  console.log('[ENTRY] StudentMarks:', window.location.pathname);
  console.log('[SESSION] localStorage:', localStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');
  console.log('[SESSION] sessionStorage:', sessionStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');

  const navigate = useNavigate();
  const [session, setSession] = useState(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('student_session') || localStorage.getItem('student_session');
    let parsedSession = null;
    try { parsedSession = raw ? JSON.parse(raw) : null; } catch (e) { console.error('[PARSE ERROR]', e); }
    
    if (!parsedSession) {
      console.log('[REDIRECT] No session found, redirecting to /StudentLogin');
      navigate('/StudentLogin');
      return;
    }
    console.log('[SESSION SET] student_id:', parsedSession.id);
    setSession(parsedSession);
  }, [navigate]);

  const { data: marks = [], isLoading } = useQuery({
    queryKey: ['student-marks', session?.id],
    queryFn: async () => {
      if (!session?.id) return [];
      try {
        const records = await base44.entities.Marks.filter({
          student_id: session.id,
          academic_year: session.academic_year,
          status: 'Published'
        }, '-created_date', 500);
        return records || [];
      } catch {
        return [];
      }
    },
    enabled: !!session?.id
  });

  if (!session) return null;

  // Group by exam_type (ID), but display using exam_type_name (denormalized).
  // Falls back to exam_type raw value only if exam_type_name is not stored yet.
  const marksGrouped = marks.reduce((acc, mark) => {
    const key = mark.exam_type;
    if (!acc[key]) acc[key] = { displayName: mark.exam_type_name || mark.exam_type, items: [] };
    acc[key].items.push(mark);
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
            <Trophy className="h-10 w-10 text-gray-200 mx-auto mb-2" />
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