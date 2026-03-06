import React, { useState, useEffect } from 'react';
import { Eye, Users, AlertCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { formatDistanceToNow, isPast } from 'date-fns';

export default function HomeworkViewOnlyCard({ homework }) {
  const [totalStudents, setTotalStudents] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStudentCount = async () => {
      try {
        const studentFilter = {
          class_name: homework.class_name,
          is_deleted: { $ne: true },
          is_active: true,
          status: { $in: ['Verified', 'Approved', 'Published'] },
        };
        if (homework.section && homework.section !== 'All') {
          studentFilter.section = homework.section;
        }
        const students = await base44.entities.Student.filter(studentFilter, 'student_id', 500);
        setTotalStudents(students.length);
      } catch (err) {
        console.error('Error loading student count:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStudentCount();
  }, [homework]);

  const isOverdue = homework.due_date && isPast(new Date(homework.due_date));
  const statusLabel = isOverdue ? 'Closed' : homework.status;
  const statusColors = {
    'Draft': 'bg-gray-100 text-gray-700',
    'Published': 'bg-blue-100 text-blue-700',
    'Closed': 'bg-slate-100 text-slate-700',
  };

  return (
    <div className="space-y-3">
      {/* Header with badges */}
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-sm text-gray-900 flex-1">{homework.title}</h3>
        
        {/* Homework type badge */}
        <div className="bg-cyan-100 text-cyan-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
          <Eye className="h-3 w-3" />
          View Only
        </div>
        
        {/* Status badge */}
        <div className={`${statusColors[statusLabel] || statusColors['Published']} px-2 py-1 rounded text-xs font-medium`}>
          {statusLabel}
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-600">
        <span><strong>Class:</strong> {homework.class_name}</span>
        {homework.section && homework.section !== 'All' && <span><strong>Section:</strong> {homework.section}</span>}
        <span><strong>Subject:</strong> {homework.subject}</span>
        {homework.due_date && (
          <span className={isOverdue ? 'text-red-600 font-semibold' : ''}>
            <strong>Due:</strong> {formatDistanceToNow(new Date(homework.due_date), { addSuffix: true })}
          </span>
        )}
      </div>

      {/* Informational metrics - ONLY total students */}
      <div className="bg-cyan-50 rounded p-3 border border-cyan-100 space-y-2">
        <div className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-600" />
            <span className="text-sm font-semibold text-cyan-900">Total Students</span>
          </div>
          <span className="text-lg font-bold text-cyan-700">{loading ? '...' : totalStudents}</span>
        </div>
        <p className="text-xs text-cyan-700 italic">
          ℹ️ Informational homework – students only need to read
        </p>
      </div>
    </div>
  );
}