import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Trophy, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function StudentMarks() {
  console.log('[ENTRY] StudentMarks:', window.location.pathname);
  console.log('[SESSION] localStorage:', localStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');
  console.log('[SESSION] sessionStorage:', sessionStorage.getItem('student_session') ? 'EXISTS' : 'MISSING');

  const navigate = useNavigate();
  const [session] = useState(() => {
    try { const s = localStorage.getItem('student_session'); return s ? JSON.parse(s) : null; } catch { return null; }
  });
  const [selectedExamType, setSelectedExamType] = useState('');

  useEffect(() => {
    if (!session) navigate(createPageUrl('StudentLogin'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark marks_published notifications as read on page open
  useEffect(() => {
    if (!session?.student_id) return;
    base44.entities.Notification.filter({
      recipient_student_id: session.student_id,
      type: 'marks_published',
      is_read: false,
    }).then(notifs => {
      if (!notifs.length) return;
      return Promise.all(notifs.map(n => base44.entities.Notification.update(n.id, { is_read: true })))
        .then(() => window.dispatchEvent(new CustomEvent('student-notifications-read')));
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: allMarks = [], isLoading } = useQuery({
    queryKey: ['student-marks', session?.student_id],
    queryFn: async () => {
      if (!session?.student_id) return [];
      // Marks RLS is read:false — use backend function that serves only Published marks
      const res = await base44.functions.invoke('getStudentMarks', {
        student_id: session.student_id,
        academic_year: session.academic_year
      });
      return res.data?.marks || [];
    },
    enabled: !!session?.student_id,
    staleTime: 5 * 60 * 1000,
  });

  // Derive distinct exam types from allMarks
  const distinctExamTypes = useMemo(() => {
    const types = new Map();
    allMarks.forEach(mark => {
      if (!types.has(mark.exam_type)) {
        types.set(mark.exam_type, {
          id: mark.exam_type,
          name: mark.exam_type_name || mark.exam_type
        });
      }
    });
    return Array.from(types.values());
  }, [allMarks]);

  // Filter marks based on selectedExamType
  const filteredMarks = useMemo(() => {
    if (!selectedExamType) return [];
    return allMarks.filter(mark => mark.exam_type === selectedExamType);
  }, [allMarks, selectedExamType]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-24">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 shadow-md">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(createPageUrl('StudentDashboard'))} className="p-1 hover:bg-white/20 rounded-lg transition">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold">My Marks</h1>
            <p className="text-sm text-blue-100">View your exam results</p>
          </div>
        </div>
      </header>

      <div className="px-4 py-6 space-y-4">
        {/* Exam Type Dropdown */}
        <Select value={selectedExamType} onValueChange={setSelectedExamType}>
          <SelectTrigger className="w-full text-base min-h-[48px]">
            <SelectValue placeholder="Select Exam Type" />
          </SelectTrigger>
          <SelectContent>
            {distinctExamTypes.map(type => (
              <SelectItem key={type.id} value={type.id} className="text-base py-3">
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block w-6 h-6 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          </div>
        ) : distinctExamTypes.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Trophy className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No published results yet</p>
          </div>
        ) : !selectedExamType ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <Trophy className="h-10 w-10 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Please select an exam type to view marks</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-sm font-bold text-gray-700">
                {distinctExamTypes.find(t => t.id === selectedExamType)?.name}
              </p>
            </div>
            <div className="divide-y divide-gray-100">
              {filteredMarks.map((mark) => (
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
        )}
      </div>
    </div>
  );
}