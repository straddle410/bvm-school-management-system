/**
 * Homework Status Normalization & Compatibility Layer
 *
 * Supports both old string statuses and new enum values.
 * All new writes must use ONLY new enum values.
 * Old reads are transparently normalized.
 */

// New enum values (single source of truth)
export const HOMEWORK_STATUS = {
  SUBMITTED: 'SUBMITTED',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
  RESUBMITTED: 'RESUBMITTED',
  GRADED: 'GRADED',
  NOT_SUBMITTED: 'NOT_SUBMITTED', // Virtual: overdue, no submission
};

// Normalize any status value to the new enum
export function normalizeHomeworkSubmissionStatus(status) {
  if (!status) return null;
  const normalized = String(status).trim().toUpperCase().replace(/ /g, '_');
  const statusMap = {
    'SUBMITTED': HOMEWORK_STATUS.SUBMITTED,
    'REVISION_REQUIRED': HOMEWORK_STATUS.REVISION_REQUIRED,
    'RESUBMITTED': HOMEWORK_STATUS.RESUBMITTED,
    'GRADED': HOMEWORK_STATUS.GRADED,
    'NOT_SUBMITTED': HOMEWORK_STATUS.NOT_SUBMITTED,
  };
  return statusMap[normalized] || status;
}

// Check if status is considered "final" (student can't submit further)
export function isHomeworkStatusFinal(status) {
  const normalized = normalizeHomeworkSubmissionStatus(status);
  return normalized === HOMEWORK_STATUS.GRADED;
}

// Check if status allows resubmission
export function canResubmitHomework(status) {
  const normalized = normalizeHomeworkSubmissionStatus(status);
  return normalized === HOMEWORK_STATUS.REVISION_REQUIRED || normalized === HOMEWORK_STATUS.RESUBMITTED;
}

// Check if status is in "awaiting review" state
export function isHomeworkAwaitingReview(status) {
  const normalized = normalizeHomeworkSubmissionStatus(status);
  return normalized === HOMEWORK_STATUS.SUBMITTED || normalized === HOMEWORK_STATUS.RESUBMITTED;
}

/**
 * Compute effective_due_date:
 * Returns extended_due_date if set, else due_date.
 * Always returns a plain date string (yyyy-MM-dd) or null.
 */
export function getEffectiveDueDate(homework) {
  return homework?.extended_due_date || homework?.due_date || null;
}

/**
 * Returns true if the effective due date has passed (end-of-day).
 */
export function isOverdueByEffectiveDueDate(homework) {
  const edd = getEffectiveDueDate(homework);
  if (!edd) return false;
  const dueMs = new Date(edd + 'T23:59:59').getTime();
  return Date.now() > dueMs;
}

/**
 * Build virtual NOT_SUBMITTED rows for a homework:
 * For every assigned student who has NO real submission record,
 * and the effective_due_date has passed, return a synthetic "not submitted" row.
 *
 * @param {Object} homework
 * @param {Map} latestRealSubmissionMap - Map<student_id, submission>
 * @param {Array} assignedStudents
 * @returns {Array} synthetic submission-like objects with status NOT_SUBMITTED
 */
export function buildNotSubmittedRows(homework, latestRealSubmissionMap, assignedStudents) {
  if (homework.submission_mode !== 'SUBMISSION_REQUIRED') return [];
  if (!isOverdueByEffectiveDueDate(homework)) return [];

  return assignedStudents
    .filter(st => !latestRealSubmissionMap.has(st.student_id))
    .map(st => ({
      _virtual: true,
      homework_id: homework.id,
      student_id: st.student_id,
      student_name: st.name,
      class_name: st.class_name,
      section: st.section,
      status: HOMEWORK_STATUS.NOT_SUBMITTED,
      teacher_marks: 0,
      teacher_feedback: '',
      is_late: true,
      submitted_at: null,
    }));
}