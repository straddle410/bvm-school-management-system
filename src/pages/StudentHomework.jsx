import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Clock, CheckCircle, AlertCircle, ChevronRight, X } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import StudentBottomNav from '@/components/StudentBottomNav';
import HomeworkTakeModal from '@/components/homework/HomeworkTakeModal.jsx';
import { createPageUrl } from '@/utils';

const TYPE_COLORS = {
  MCQ: 'bg-purple-100 text-purple-700',
  Descriptive: 'bg-blue-100 text-blue-700',
  Project: 'bg-green-100 text-green-700',
  Assignment: 'bg-amber-100 text-amber-700',
  Other: 'bg-gray-100 text-gray-700',
};

function getStudentSession() {
  try { const s = localStorage.getItem('student_session'); return s ? JSON.parse(s) : null; } catch { return null; }
}

export default function StudentHomework() {
   const [student, setStudent] = useState(null);
   const [activeHW, setActiveHW] = useState(null);
   const [filter, setFilter] = useState('all');

   useEffect(() => {
      const s = getStudentSession();
      if (!s) { window.location.href = createPageUrl('StudentLogin'); return; }
      setStudent(s);
    }, []);

  const { data: homeworks = [], isLoading } = useQuery({
    queryKey: ['student-homework', student?.class_name, student?.section, student?.academic_year],
    enabled: !!student,
    queryFn: async () => {
      const allHomework = await base44.entities.Homework.filter(
        { 
          class_name: student.class_name, 
          academic_year: student.academic_year,
          status: 'Published' 
        },
        '-due_date',
        200
      );

      const filtered = allHomework.filter(hw => {
        const hwSection = hw.section || 'All';
        const classMatch = hw.class_name === student.class_name;
        const sectionMatch = hwSection === 'All' || hwSection === student.section;
        const academicYearMatch = !hw.academic_year || hw.academic_year === student.academic_year;
        const statusMatch = hw.status === 'Published';
        return classMatch && sectionMatch && academicYearMatch && statusMatch;
      });

      return filtered;
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['student-submissions', student?.student_id],
    enabled: !!student,
    queryFn: () => base44.entities.HomeworkSubmission.filter({ student_id: student.student_id }, '-created_date', 200),
  });



  if (!student) return null;

  const submittedMap = {};
  submissions.forEach(s => { submittedMap[s.homework_id] = s; });

  const today = new Date();
  const filtered = homeworks.filter(hw => {
    if (filter === 'submitted') return !!submittedMap[hw.id];
    if (filter === 'pending') return !submittedMap[hw.id];
    return true;
  });

  const getStatus = (hw) => {
    const sub = submittedMap[hw.id];
    if (sub) return { label: sub.status === 'Graded' ? `Graded: ${sub.teacher_marks !== undefined ? sub.teacher_marks : '?'}/${hw.max_marks || '?'}` : 'Submitted', color: 'bg-green-100 text-green-700', done: true };
    if (hw.submission_mode === 'VIEW_ONLY') return { label: 'View Only', color: 'bg-blue-100 text-blue-700', done: true };
    if (hw.due_date && new Date(hw.due_date) < today) return { label: 'Late', color: 'bg-red-100 text-red-700', done: false };
    return { label: 'Pending', color: 'bg-amber-100 text-amber-700', done: false };
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-md mx-auto pb-20" style={{ fontFamily: "'Segoe UI', sans-serif" }}>
      <header className="bg-[#1a237e] text-white px-4 py-3 sticky top-0 z-40 shadow-md">
        <h1 className="font-bold text-lg">My Homework</h1>
        <p className="text-blue-200 text-xs">Class {student.class_name} • {student.name}</p>
      </header>

      <div className="p-4 space-y-4">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          {[['all','All'],['pending','Pending'],['submitted','Submitted']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === v ? 'bg-[#1a237e] text-white' : 'bg-white text-gray-600'}`}>
              {l}
            </button>
          ))}
        </div>

        {/* Homework List */}
        {isLoading ? (
          <div className="text-center py-10 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <BookOpen className="h-10 w-10 mx-auto mb-2 text-gray-200" />
            <p className="text-gray-400 text-sm">No homework found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(hw => {
              const status = getStatus(hw);
              return (
                <div key={hw.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TYPE_COLORS[hw.homework_type] || 'bg-gray-100 text-gray-600'}`}>
                          {hw.homework_type}
                        </span>
                        <p className="font-bold text-slate-800 text-sm mt-1">{hw.title}</p>
                        <p className="text-xs text-slate-500">{hw.subject} {hw.assigned_by ? `• ${hw.assigned_by}` : ''}</p>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    {hw.description && <p className="text-xs text-slate-600 mb-2 line-clamp-2">{hw.description}</p>}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Due: {hw.due_date ? format(new Date(hw.due_date), 'dd MMM yyyy') : 'No date'}
                      </span>
                      {hw.submission_mode === 'VIEW_ONLY' ? (
                        <button
                          onClick={() => setActiveHW(hw)}
                          className="text-xs font-semibold text-[#1a237e] border border-[#1a237e] px-3 py-1.5 rounded-lg"
                        >
                          View
                        </button>
                      ) : !status.done ? (
                        <button
                          onClick={() => setActiveHW(hw)}
                          className="text-xs font-semibold text-white bg-[#1a237e] px-3 py-1.5 rounded-lg flex items-center gap-1"
                        >
                          Submit <ChevronRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveHW(hw)}
                          className="text-xs font-semibold text-[#1a237e] border border-[#1a237e] px-3 py-1.5 rounded-lg"
                        >
                          View
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Graded feedback */}
                  {submittedMap[hw.id]?.status === 'Graded' && submittedMap[hw.id]?.teacher_feedback && (
                    <div className="bg-green-50 px-4 py-2 border-t border-green-100">
                      <p className="text-xs text-green-700">💬 {submittedMap[hw.id].teacher_feedback}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {activeHW && (
        <HomeworkTakeModal
          homework={activeHW}
          student={student}
          existingSubmission={submittedMap[activeHW.id]}
          onClose={() => setActiveHW(null)}
        />
      )}

      <StudentBottomNav currentPage="StudentHomework" />
    </div>
  );
}