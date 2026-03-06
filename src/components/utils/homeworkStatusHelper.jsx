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
  GRADED: 'GRADED'
};

// Normalize any status value to the new enum
// Accepts old string values like "Submitted", "Graded" and converts to new enum
export function normalizeHomeworkSubmissionStatus(status) {
  if (!status) return null;
  
  const normalized = String(status).trim().toUpperCase();
  
  // Map old string values to new enum
  const statusMap = {
    'SUBMITTED': HOMEWORK_STATUS.SUBMITTED,
    'REVISION_REQUIRED': HOMEWORK_STATUS.REVISION_REQUIRED,
    'REVISION REQUIRED': HOMEWORK_STATUS.REVISION_REQUIRED, // Alternate old format
    'RESUBMITTED': HOMEWORK_STATUS.RESUBMITTED,
    'GRADED': HOMEWORK_STATUS.GRADED,
    
    // Old string values (backward compatibility)
    'SUBMITTED': HOMEWORK_STATUS.SUBMITTED,
    'GRADED': HOMEWORK_STATUS.GRADED,
  };
  
  return statusMap[normalized] || status; // Return original if no match
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