import {
  normalizeHomeworkSubmissionStatus,
  HOMEWORK_STATUS,
  getEffectiveDueDate,
  isOverdueByEffectiveDueDate,
  buildNotSubmittedRows,
} from '@/components/utils/homeworkStatusHelper';

/**
 * Get the latest/current submission for each student.
 * For each student_id, keeps only the most recent submission by timestamp.
 */
export function getLatestSubmissionPerStudent(submissions) {
  const latestMap = new Map();
  submissions.forEach((sub) => {
    const current = latestMap.get(sub.student_id);
    if (!current) {
      latestMap.set(sub.student_id, sub);
    } else {
      const currentTime = new Date(current.submitted_at || current.updated_at || 0).getTime();
      const newTime = new Date(sub.submitted_at || sub.updated_at || 0).getTime();
      if (newTime > currentTime) latestMap.set(sub.student_id, sub);
    }
  });
  return latestMap;
}

/**
 * Calculate aggregated metrics for a homework assignment.
 * Uses effective_due_date (extended_due_date if set, else due_date) for overdue/pending logic.
 * Students with no submission after effective_due_date are counted as NOT_SUBMITTED (zero marks).
 */
export function getHomeworkAggregatedMetrics(homework, submissions, assignedStudents) {
  if (homework.submission_mode === 'VIEW_ONLY') {
    return {
      totalStudents: assignedStudents.length,
      submittedCount: 0,
      pendingCount: 0,
      gradedCount: 0,
      revisionRequiredCount: 0,
      lateCount: 0,
      notSubmittedCount: 0,
      completionPercent: 0,
      averageMarks: null,
      highestMarks: null,
      lowestMarks: null,
      latestSubmissionMap: new Map(),
      effectiveDueDate: getEffectiveDueDate(homework),
    };
  }

  const hwSubmissions = submissions.filter(s => s.homework_id === homework.id);
  const latestMap = getLatestSubmissionPerStudent(hwSubmissions);

  // Normalize statuses
  const latestByStatus = new Map();
  latestMap.forEach((sub, studentId) => {
    const normalized = normalizeHomeworkSubmissionStatus(sub.status);
    latestByStatus.set(studentId, { ...sub, status: normalized, normalizedStatus: normalized });
  });

  // Build virtual NOT_SUBMITTED rows for overdue students with no submission
  const notSubmittedRows = buildNotSubmittedRows(homework, latestMap, assignedStudents);
  notSubmittedRows.forEach(row => {
    latestByStatus.set(row.student_id, { ...row, normalizedStatus: HOMEWORK_STATUS.NOT_SUBMITTED });
  });

  const allLatest = Array.from(latestByStatus.values());

  const submittedCount = allLatest.filter(
    s => s.normalizedStatus === HOMEWORK_STATUS.SUBMITTED || s.normalizedStatus === HOMEWORK_STATUS.RESUBMITTED
  ).length;

  const gradedCount = allLatest.filter(s => s.normalizedStatus === HOMEWORK_STATUS.GRADED).length;

  const revisionRequiredCount = allLatest.filter(
    s => s.normalizedStatus === HOMEWORK_STATUS.REVISION_REQUIRED
  ).length;

  const notSubmittedCount = allLatest.filter(
    s => s.normalizedStatus === HOMEWORK_STATUS.NOT_SUBMITTED
  ).length;

  // lateCount = only REAL submitted records that were late (exclude virtual NOT_SUBMITTED rows)
  const lateCount = allLatest.filter(s => s.is_late === true && !s._virtual).length;

  const totalStudents = assignedStudents.length;
  // Pending = assigned students who have neither submitted nor been marked NOT_SUBMITTED
  const totalAccountedFor = latestByStatus.size;
  const pendingCount = Math.max(0, totalStudents - totalAccountedFor);

  // Completion = anyone who has submitted (any status except pending/not_submitted)
  const completionPercent = totalStudents > 0
    ? Math.round(((totalAccountedFor - notSubmittedCount) / totalStudents) * 100)
    : 0;

  // Marks statistics (GRADED only)
  const gradedWithMarks = allLatest.filter(
    s => s.normalizedStatus === HOMEWORK_STATUS.GRADED && s.teacher_marks != null
  );

  const averageMarks = gradedWithMarks.length > 0
    ? gradedWithMarks.reduce((sum, s) => sum + Number(s.teacher_marks), 0) / gradedWithMarks.length
    : null;
  const highestMarks = gradedWithMarks.length > 0
    ? Math.max(...gradedWithMarks.map(s => Number(s.teacher_marks))) : null;
  const lowestMarks = gradedWithMarks.length > 0
    ? Math.min(...gradedWithMarks.map(s => Number(s.teacher_marks))) : null;

  return {
    totalStudents,
    submittedCount,
    pendingCount,
    gradedCount,
    revisionRequiredCount,
    lateCount,
    notSubmittedCount,
    completionPercent,
    averageMarks,
    highestMarks,
    lowestMarks,
    latestSubmissionMap: latestByStatus,
    effectiveDueDate: getEffectiveDueDate(homework),
  };
}