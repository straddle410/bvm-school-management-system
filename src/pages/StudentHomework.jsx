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
   const [debugInfo, setDebugInfo] = useState(null);
   const [rejections, setRejections] = useState([]);
   const [latestClass2, setLatestClass2] = useState(null);

   useEffect(() => {
      const s = getStudentSession();
      if (!s) { window.location.href = createPageUrl('StudentLogin'); return; }
      console.error('[STUDENT_HOMEWORK_SESSION]', {
        student_id: s.student_id,
        class_name: s.class_name,
        section: s.section,
        academic_year: s.academic_year,
        name: s.name,
      });
      setStudent(s);

      // Fetch latest Class 2-A homework for comparison
      (async () => {
        try {
          const hw = await base44.entities.Homework.filter(
            { class_name: '2', status: 'Published' },
            '-created_date',
            1
          );
          if (hw && hw.length > 0) {
            console.error('[LATEST_CLASS2_HOMEWORK]', {
              id: hw[0].id,
              title: hw[0].title,
              class_name: hw[0].class_name,
              section: hw[0].section || 'NOT_SET',
              academic_year: hw[0].academic_year || 'NOT_SET',
              status: hw[0].status,
              subject: hw[0].subject,
              due_date: hw[0].due_date,
            });
            setLatestClass2(hw[0]);
          }
        } catch (err) {
          console.error('[LATEST_CLASS2_ERROR]', err.message);
        }
      })();
    }, []);

  const { data: homeworks = [], isLoading } = useQuery({
    queryKey: ['student-homework', student?.class_name, student?.section, student?.academic_year],
    enabled: !!student,
    queryFn: async () => {
      console.error('[STUDENT_HW_QUERY_START]', {
        class: student.class_name,
        section: student.section,
        year: student.academic_year,
      });

      const allHomework = await base44.entities.Homework.filter(
        { 
          class_name: student.class_name, 
          academic_year: student.academic_year,
          status: 'Published' 
        },
        '-due_date',
        200
      );

      console.error('[STUDENT_HOMEWORK_ALL]', allHomework.map(hw => ({
        id: hw.id,
        title: hw.title,
        class_name: hw.class_name,
        section: hw.section,
        academic_year: hw.academic_year,
        status: hw.status,
        due_date: hw.due_date,
      })));

      const rejectReasons = [];
      const filtered = allHomework.filter(hw => {
        const hwSection = hw.section || 'All';
        const classMatch = hw.class_name === student.class_name;
        const sectionMatch = hwSection === 'All' || hwSection === student.section;
        const academicYearMatch = !hw.academic_year || hw.academic_year === student.academic_year;
        const statusMatch = hw.status === 'Published';
        const match = classMatch && sectionMatch && academicYearMatch && statusMatch;

        if (!match) {
          const reason = !classMatch ? 'CLASS_MISMATCH' : !sectionMatch ? 'SECTION_MISMATCH' : !academicYearMatch ? 'YEAR_MISMATCH' : 'STATUS_NOT_PUBLISHED';
          console.warn('[STUDENT_HW_REJECT]', {
            id: hw.id,
            title: hw.title,
            hw_class_name: hw.class_name,
            hw_section: hwSection,
            hw_academic_year: hw.academic_year || 'NOT_SET',
            hw_status: hw.status,
            student_class_name: student.class_name,
            student_section: student.section,
            student_academic_year: student.academic_year,
            reason,
          });
          rejectReasons.push({ title: hw.title, reason });
        }
        return match;
      });

      console.error('[STUDENT_HOMEWORK_FILTERED]', {
        allCount: allHomework.length,
        filteredCount: filtered.length,
        filtered: filtered.map(hw => ({ 
          id: hw.id, 
          title: hw.title,
          class: hw.class_name,
          section: hw.section,
          academic_year: hw.academic_year,
          status: hw.status,
        })),
      });

      setDebugInfo({
        allCount: allHomework.length,
        filteredCount: filtered.length,
        lastRejectReason: rejectReasons.length > 0 ? rejectReasons[0].reason : 'N/A',
      });
      setRejections(rejectReasons);

      return filtered;
    },
  });

  const { data: submissions = [] } = useQuery({
    queryKey: ['student-submissions', student?.student_id],
    enabled: !!student,
    queryFn: () => base44.entities.HomeworkSubmission.filter({ student_id: student.student_id }, '-created_date', 200),
  });

  // Log final state when both loaded
  useEffect(() => {
    if (student && homeworks.length >= 0 && !isLoading) {
      console.error('[FINAL_STATE]', {
        student: {
          student_id: student.student_id,
          class_name: student.class_name,
          section: student.section,
          academic_year: student.academic_year,
        },
        debug: debugInfo,
        rejectionCount: rejections.length,
        visibleHomeworkCount: homeworks.length,
      });
    }
  }, [student, homeworks, isLoading, debugInfo]);

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

      {/* DEBUG BOX - VISIBLE ON PAGE */}
      <div className="bg-yellow-100 border-2 border-red-500 p-3 m-2 rounded text-xs font-mono">
        <p className="font-bold text-red-700">🔴 DEBUG INFO</p>
        <p><strong>Session:</strong> Class {student.class_name}, Section {student.section}, Year {student.academic_year}</p>
        <p><strong>All Homework Count:</strong> {debugInfo?.allCount || '?'}</p>
        <p><strong>Filtered Count:</strong> {debugInfo?.filteredCount || '?'}</p>
        <p><strong>Latest Rejection:</strong> {debugInfo?.lastRejectReason || 'NONE'}</p>
        {latestClass2 && (
          <>
            <p className="mt-2 border-t pt-2"><strong>Latest Class 2 Homework:</strong></p>
            <p>• ID: {latestClass2.id}</p>
            <p>• Title: {latestClass2.title}</p>
            <p>• Class: {latestClass2.class_name}</p>
            <p>• Section: {latestClass2.section || 'NOT_SET'}</p>
            <p>• Year: {latestClass2.academic_year || 'NOT_SET'}</p>
            <p>• Status: {latestClass2.status}</p>
          </>
        )}
        {rejections.length > 0 && (
          <div className="mt-2 border-t pt-2">
            <p><strong>Rejections:</strong></p>
            {rejections.slice(0, 3).map((r, i) => (
              <p key={i}>• {r.title} - {r.reason}</p>
            ))}
          </div>
        )}
      </div>

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