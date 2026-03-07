import React, { useState, useEffect } from 'react';
import { AlertCircle, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';

/**
 * Display list of students who have not submitted SUBMISSION_REQUIRED homework.
 * Used in teacher reminders/awareness.
 */
export default function PendingStudentsList({ homework, submissions = [] }) {
  const [pendingStudents, setPendingStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPendingStudents = async () => {
      try {
        // Only show for SUBMISSION_REQUIRED homework
        if (homework.submission_mode === 'VIEW_ONLY') {
          setPendingStudents([]);
          setLoading(false);
          return;
        }

        // Get assigned students
        const studentFilter = {
          class_name: homework.class_name,
          is_deleted: false,
          is_active: true,
          status: 'Published',
          academic_year: homework.academic_year,
        };
        if (homework.section && homework.section !== 'All') {
          studentFilter.section = homework.section;
        }
        const students = await base44.entities.Student.filter(studentFilter, 'student_id', 500);

        // Get submitted students for this homework
        const hwSubmissions = submissions.filter(s => s.homework_id === homework.id);
        const submittedStudentIds = new Set(hwSubmissions.map(s => s.student_id));

        // Find pending students
        const pending = students.filter(s => !submittedStudentIds.has(s.student_id));
        setPendingStudents(pending);
      } catch (err) {
        console.error('Error loading pending students:', err);
      } finally {
        setLoading(false);
      }
    };

    loadPendingStudents();
  }, [homework, submissions]);

  // Don't show for VIEW_ONLY
  if (homework.submission_mode === 'VIEW_ONLY') {
    return null;
  }

  if (loading) {
    return <div className="text-xs text-gray-400">Loading...</div>;
  }

  if (pendingStudents.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 bg-red-50 rounded-lg border border-red-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <p className="text-xs font-semibold text-red-900">
          {pendingStudents.length} student{pendingStudents.length !== 1 ? 's' : ''} not submitted
        </p>
      </div>
      <div className="space-y-1 max-h-32 overflow-y-auto">
        {pendingStudents.slice(0, 5).map(student => (
          <div key={student.id} className="text-xs text-red-700 flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-red-600" />
            <span className="font-medium">{student.name}</span>
            <span className="text-red-600">({student.roll_no || 'No Roll'})</span>
          </div>
        ))}
        {pendingStudents.length > 5 && (
          <p className="text-xs text-red-600 italic">+{pendingStudents.length - 5} more</p>
        )}
      </div>
    </div>
  );
}