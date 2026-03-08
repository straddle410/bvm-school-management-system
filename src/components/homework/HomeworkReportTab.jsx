import React, { useState, useMemo } from 'react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { HOMEWORK_STATUS, normalizeHomeworkSubmissionStatus } from '@/components/utils/homeworkStatusHelper';
import { format } from 'date-fns';
import { Download } from 'lucide-react';

export default function HomeworkReportTab({ homeworkList = [], submissions = [] }) {
  const { academicYear } = useAcademicYear();
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterHomework, setFilterHomework] = useState('');

  const uniqueClasses = [...new Set(homeworkList.map(h => h.class_name))].sort();
  const uniqueSections = [...new Set(homeworkList.map(h => h.section).filter(Boolean))].sort();
  const uniqueSubjects = [...new Set(homeworkList.map(h => h.subject).filter(Boolean))].sort();

  const filteredHomework = useMemo(() => homeworkList.filter(h => {
    if (filterClass && h.class_name !== filterClass) return false;
    if (filterSection && h.section !== filterSection) return false;
    if (filterSubject && h.subject !== filterSubject) return false;
    if (filterHomework && h.id !== filterHomework) return false;
    if (h.submission_mode !== 'SUBMISSION_REQUIRED') return false;
    return true;
  }), [homeworkList, filterClass, filterSection, filterSubject, filterHomework]);

  // Build rows: one row per (homework, submission) — latest per student per homework
  const rows = useMemo(() => {
    const result = [];
    filteredHomework.forEach(hw => {
      const hwSubs = submissions.filter(s => s.homework_id === hw.id);
      // deduplicate to latest per student
      const latestMap = new Map();
      hwSubs.forEach(s => {
        const key = s.student_id;
        const cur = latestMap.get(key);
        const subTs = new Date(s.submitted_at || s.updated_at || 0).getTime();
        const curTs = cur ? new Date(cur.submitted_at || cur.updated_at || 0).getTime() : 0;
        if (!cur || subTs > curTs) latestMap.set(key, s);
      });
      latestMap.forEach(sub => {
        result.push({
          hw,
          sub,
          status: normalizeHomeworkSubmissionStatus(sub.status),
        });
      });
    });
    return result;
  }, [filteredHomework, submissions]);

  // Per-student aggregation
  // Rules:
  // - Total Max = sum of max_marks for ALL filtered homework items (regardless of submission status)
  // - Total Awarded = sum of teacher_marks for GRADED submissions only (0 for unsubmitted/ungraded)
  const studentTotals = useMemo(() => {
    // Total max marks is the same for every student — it's the sum of all filtered homework max_marks
    const totalMaxForFilteredHw = filteredHomework.reduce(
      (sum, hw) => sum + (hw.max_marks != null ? Number(hw.max_marks) : 0),
      0
    );

    const totals = new Map();

    // Seed all students found in any submission
    rows.forEach(({ sub }) => {
      const key = sub.student_id;
      if (!totals.has(key)) {
        totals.set(key, {
          awarded: 0,
          max: totalMaxForFilteredHw,
          name: sub.student_name,
          id: sub.student_id,
        });
      }
      const t = totals.get(key);
      // Only add awarded marks for GRADED submissions
      const status = normalizeHomeworkSubmissionStatus(sub.status);
      if (status === HOMEWORK_STATUS.GRADED && sub.teacher_marks != null) {
        t.awarded += Number(sub.teacher_marks);
      }
    });

    return totals;
  }, [rows, filteredHomework]);

  const statusColors = {
    [HOMEWORK_STATUS.SUBMITTED]: 'text-blue-700 bg-blue-50',
    [HOMEWORK_STATUS.RESUBMITTED]: 'text-indigo-700 bg-indigo-50',
    [HOMEWORK_STATUS.GRADED]: 'text-green-700 bg-green-50',
    [HOMEWORK_STATUS.REVISION_REQUIRED]: 'text-orange-700 bg-orange-50',
  };

  const handleExport = () => {
    const headers = ['Student Name','Student ID','Class','Section','Homework','Subject','Due Date','Status','Marks','Max Marks','Remark'];
    const csvRows = [headers.join(',')];
    rows.forEach(({ hw, sub, status }) => {
      csvRows.push([
        `"${sub.student_name || ''}"`,
        sub.student_id || '',
        hw.class_name || '',
        hw.section || '',
        `"${hw.title || ''}"`,
        hw.subject || '',
        hw.due_date || '',
        status || '',
        sub.teacher_marks ?? '',
        hw.max_marks ?? '',
        `"${(sub.teacher_feedback || '').replace(/"/g, "'")}"`,
      ].join(','));
    });
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `homework_report_${academicYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl p-4 border border-gray-200 space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterSection(''); setFilterHomework(''); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All Classes</option>
            {uniqueClasses.map(c => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select value={filterSection} onChange={e => setFilterSection(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All Sections</option>
            {uniqueSections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterSubject} onChange={e => { setFilterSubject(e.target.value); setFilterHomework(''); }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All Subjects</option>
            {uniqueSubjects.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={filterHomework} onChange={e => setFilterHomework(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All Homework</option>
            {homeworkList.filter(h => h.submission_mode === 'SUBMISSION_REQUIRED'
              && (!filterClass || h.class_name === filterClass)
              && (!filterSubject || h.subject === filterSubject)
            ).map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">{rows.length} submission record{rows.length !== 1 ? 's' : ''} · Academic Year: {academicYear}</p>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No submission data for the selected filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Student</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Class</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Homework</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Subject</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Due</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Status</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Marks</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Max</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 whitespace-nowrap">Remark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ hw, sub, status }, idx) => (
                <tr key={`${hw.id}-${sub.student_id}`} className={`border-b border-gray-50 ${idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                  <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">{sub.student_name || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{sub.student_id}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{hw.class_name}{hw.section && hw.section !== 'All' ? `-${hw.section}` : ''}</td>
                  <td className="px-3 py-2.5 text-gray-700 max-w-[140px] truncate" title={hw.title}>{hw.title}</td>
                  <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{hw.subject}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{hw.due_date ? format(new Date(hw.due_date), 'dd MMM yy') : '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${statusColors[status] || 'bg-gray-100 text-gray-600'}`}>{status}</span>
                    {sub.is_late && <span className="ml-1 text-[10px] text-red-500 font-medium">Late</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-green-700 whitespace-nowrap">{sub.teacher_marks ?? '—'}</td>
                  <td className="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">{hw.max_marks ?? '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate" title={sub.teacher_feedback}>{sub.teacher_feedback || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Per-student totals */}
      {rows.length > 0 && studentTotals.size > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-slate-800">Per-Student Totals</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Total Max = {filteredHomework.reduce((s, hw) => s + (hw.max_marks != null ? Number(hw.max_marks) : 0), 0)} marks
              ({filteredHomework.filter(hw => hw.max_marks != null).length} homework item{filteredHomework.filter(hw => hw.max_marks != null).length !== 1 ? 's' : ''} with marks)
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Student</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600">ID</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Total Awarded</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Total Max</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600">Percentage</th>
              </tr>
            </thead>
            <tbody>
              {Array.from(studentTotals.values()).sort((a, b) => b.awarded - a.awarded).map(t => (
                <tr key={t.id} className="border-b border-gray-50">
                  <td className="px-3 py-2 font-medium text-slate-800">{t.name || '—'}</td>
                  <td className="px-3 py-2 text-gray-500">{t.id}</td>
                  <td className="px-3 py-2 text-right font-bold text-green-700">{t.awarded}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{t.max || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold text-indigo-700">
                    {t.max > 0 ? `${Math.round((t.awarded / t.max) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}