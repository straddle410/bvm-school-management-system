import React, { useState, useMemo } from 'react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import {
  HOMEWORK_STATUS,
  normalizeHomeworkSubmissionStatus,
  getEffectiveDueDate,
  buildNotSubmittedRows,
} from '@/components/utils/homeworkStatusHelper';
import { getLatestSubmissionPerStudent } from '@/components/homework/homeworkAggregationHelper';
import { format } from 'date-fns';
import { Download } from 'lucide-react';

// Status display config — includes NOT_SUBMITTED
const STATUS_COLORS = {
  [HOMEWORK_STATUS.SUBMITTED]: 'text-blue-700 bg-blue-50',
  [HOMEWORK_STATUS.RESUBMITTED]: 'text-indigo-700 bg-indigo-50',
  [HOMEWORK_STATUS.GRADED]: 'text-green-700 bg-green-50',
  [HOMEWORK_STATUS.REVISION_REQUIRED]: 'text-orange-700 bg-orange-50',
  [HOMEWORK_STATUS.NOT_SUBMITTED]: 'text-red-700 bg-red-50',
};

export default function HomeworkReportTab({ homeworkList = [], submissions = [], assignedStudentsByHw = {} }) {
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

  /**
   * Build rows:
   * - For each filtered homework, get the latest real submission per student.
   * - For overdue homework with no submission, inject a NOT_SUBMITTED virtual row (0 marks).
   * - LATEST FINAL GRADE WINS: if a student has both a real graded submission AND an old
   *   NOT_SUBMITTED scenario, the real graded one always wins because latestRealMap will have them.
   */
  const rows = useMemo(() => {
    const result = [];
    filteredHomework.forEach(hw => {
      const hwSubs = submissions.filter(s => s.homework_id === hw.id);
      const latestRealMap = getLatestSubmissionPerStudent(hwSubs);

      // Resolve final row per student — real submission always beats virtual NOT_SUBMITTED
      const finalMap = new Map();

      // Seed real submissions first (they win)
      latestRealMap.forEach((sub, studentId) => {
        finalMap.set(studentId, {
          hw,
          sub: { ...sub, status: normalizeHomeworkSubmissionStatus(sub.status) },
          isVirtual: false,
        });
      });

      // Add NOT_SUBMITTED virtual rows only for students with NO real submission
      // Use assignedStudentsByHw if provided (from parent), otherwise skip virtual rows
      const assignedStudents = assignedStudentsByHw[hw.id] || [];
      const notSubmitted = buildNotSubmittedRows(hw, latestRealMap, assignedStudents);
      notSubmitted.forEach(row => {
        if (!finalMap.has(row.student_id)) {
          finalMap.set(row.student_id, { hw, sub: row, isVirtual: true });
        }
      });

      finalMap.forEach(entry => result.push(entry));
    });
    return result;
  }, [filteredHomework, submissions, assignedStudentsByHw]);

  /**
   * Per-student totals:
   * - Total Max = sum of max_marks for ALL filtered homework (same for every student)
   * - Total Awarded:
   *   - GRADED → teacher_marks
   *   - NOT_SUBMITTED (virtual) → 0
   *   - All other statuses → 0 (pending/submitted/revision = not yet finalized)
   */
  const studentTotals = useMemo(() => {
    const totalMaxForFilteredHw = filteredHomework.reduce(
      (sum, hw) => sum + (hw.max_marks != null ? Number(hw.max_marks) : 0),
      0
    );

    const totals = new Map();

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
      const status = normalizeHomeworkSubmissionStatus(sub.status);
      if (status === HOMEWORK_STATUS.GRADED && sub.teacher_marks != null) {
        t.awarded += Number(sub.teacher_marks);
      }
      // NOT_SUBMITTED contributes 0 — no action needed (already initialized to 0)
    });

    return totals;
  }, [rows, filteredHomework]);

  const handleExport = () => {
    const headers = ['Student Name','Student ID','Class','Section','Homework','Subject','Original Due','Effective Due','Status','Marks','Max Marks','Remark','Virtual'];
    const csvRows = [headers.join(',')];
    rows.forEach(({ hw, sub, isVirtual }) => {
      const effectiveDue = getEffectiveDueDate(hw);
      csvRows.push([
        `"${sub.student_name || ''}"`,
        sub.student_id || '',
        hw.class_name || '',
        hw.section || '',
        `"${hw.title || ''}"`,
        hw.subject || '',
        hw.due_date || '',
        effectiveDue || '',
        sub.status || '',
        sub.teacher_marks ?? 0,
        hw.max_marks ?? '',
        `"${(sub.teacher_feedback || '').replace(/"/g, "'")}"`,
        isVirtual ? 'YES' : 'NO',
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
      <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 space-y-3">
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
            {homeworkList.filter(h =>
              h.submission_mode === 'SUBMISSION_REQUIRED' &&
              (!filterClass || h.class_name === filterClass) &&
              (!filterSubject || h.subject === filterSubject)
            ).map(h => <option key={h.id} value={h.id}>{h.title}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">
            {rows.length} record{rows.length !== 1 ? 's' : ''} · {rows.filter(r => r.isVirtual).length} not-submitted (auto-zero) · Academic Year: {academicYear}
          </p>
          <button onClick={handleExport} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
        {rows.length === 0 ? (
          <p className="text-center text-gray-400 py-12 text-sm">No data for the selected filters.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Student</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">ID</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Class</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Homework</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Subject</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Eff. Due</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Status</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Marks</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Max</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300 whitespace-nowrap">Remark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ hw, sub, isVirtual }, idx) => {
                const effectiveDue = getEffectiveDueDate(hw);
                return (
                  <tr key={`${hw.id}-${sub.student_id}-${isVirtual ? 'v' : 'r'}`}
                    className={`border-b border-gray-50 ${isVirtual ? 'bg-red-50/30' : idx % 2 === 0 ? '' : 'bg-gray-50/40'}`}>
                    <td className="px-3 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                      {sub.student_name || '—'}
                      {isVirtual && <span className="ml-1 text-[9px] text-red-500 font-bold uppercase">Auto</span>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{sub.student_id}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                      {hw.class_name}{hw.section && hw.section !== 'All' ? `-${hw.section}` : ''}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 max-w-[140px] truncate" title={hw.title}>{hw.title}</td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">{hw.subject}</td>
                    <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">
                      {effectiveDue ? format(new Date(effectiveDue), 'dd MMM yy') : '—'}
                      {hw.extended_due_date && <span className="ml-1 text-amber-500 text-[9px]">ext</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-semibold text-[10px] ${STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
                        {sub.status}
                      </span>
                      {sub.is_late && !isVirtual && (
                        <span className="ml-1 text-[10px] text-red-500 font-medium">Late</span>
                      )}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${isVirtual ? 'text-red-600' : 'text-green-700'}`}>
                      {sub.status === HOMEWORK_STATUS.GRADED ? sub.teacher_marks : isVirtual ? '0' : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-500 whitespace-nowrap">{hw.max_marks ?? '—'}</td>
                    <td className="px-3 py-2.5 text-gray-500 max-w-[120px] truncate" title={sub.teacher_feedback}>
                      {isVirtual ? 'Not submitted' : sub.teacher_feedback || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Per-student totals */}
      {rows.length > 0 && studentTotals.size > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-x-auto">
          <div className="px-4 py-3 border-b border-gray-100">
            <h3 className="font-semibold text-sm text-slate-800">Per-Student Totals</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Total Max = {filteredHomework.reduce((s, hw) => s + (hw.max_marks != null ? Number(hw.max_marks) : 0), 0)} marks
              · Not submitted rows count as 0 awarded · Latest grade always wins
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Student</th>
                <th className="text-left px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">ID</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Total Awarded</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Total Max</th>
                <th className="text-right px-3 py-2.5 font-semibold text-gray-600 dark:text-gray-300">Percentage</th>
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