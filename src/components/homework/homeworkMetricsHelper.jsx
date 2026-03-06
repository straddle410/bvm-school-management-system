import { normalizeHomeworkSubmissionStatus } from '@/components/utils/homeworkStatusHelper';

/**
 * Build a map of latest submission per student for a homework
 * Latest determined by submitted_at timestamp (preferred) or updated_at as fallback
 */
export const getLatestSubmissionMap = (submissions) => {
  const submissionMap = new Map();
  
  submissions.forEach((sub) => {
    const key = sub.student_id;
    const current = submissionMap.get(key);
    
    // Determine timestamp for comparison
    const subTimestamp = new Date(sub.submitted_at || sub.updated_at || 0).getTime();
    const currentTimestamp = current ? new Date(current.submitted_at || current.updated_at || 0).getTime() : 0;
    
    // Keep latest by timestamp
    if (!current || subTimestamp > currentTimestamp) {
      submissionMap.set(key, {
        ...sub,
        status: normalizeHomeworkSubmissionStatus(sub.status)
      });
    }
  });
  
  return submissionMap;
};

/**
 * Aggregated metrics for a single homework
 * Returns all counts using latest-per-student logic
 */
export const getHomeworkAggregatedMetrics = (homework, submissions, assignedStudents = []) => {
  // Get latest submission per student
  const latestMap = getLatestSubmissionMap(submissions);
  
  // Total assigned students (active, non-deleted, correct status)
  const totalStudents = assignedStudents.length;
  
  // Count by status (using latest submission per student)
  const latestStatuses = Array.from(latestMap.values());
  
  const submitted = latestStatuses.filter(
    s => s.status === 'SUBMITTED' || s.status === 'RESUBMITTED'
  ).length;
  
  const graded = latestStatuses.filter(s => s.status === 'GRADED').length;
  
  const revisionRequired = latestStatuses.filter(
    s => s.status === 'REVISION_REQUIRED'
  ).length;
  
  // Late count: unique students whose latest submission has is_late = true
  const late = latestStatuses.filter(s => s.is_late).length;
  
  // Total unique submitted (any status)
  const totalUniqueSubmitted = latestMap.size;
  
  // Pending = assigned - those who submitted at least once
  const pending = Math.max(0, totalStudents - totalUniqueSubmitted);
  
  // Completion % = (unique submitted / total assigned) * 100
  const completionPercent = totalStudents > 0 
    ? Math.round((totalUniqueSubmitted / totalStudents) * 100) 
    : 0;
  
  return {
    totalStudents,
    submitted,           // Latest status = SUBMITTED or RESUBMITTED
    graded,              // Latest status = GRADED
    revisionRequired,    // Latest status = REVISION_REQUIRED
    late,                // Latest submission has is_late = true
    pending,             // No submission at all
    totalUniqueSubmitted,
    completionPercent,
    latestMap            // Return map for other uses (e.g., marks statistics)
  };
};

/**
 * Get graded submissions for marks statistics
 * Only includes students whose latest submission is GRADED with teacher_marks
 */
export const getGradedSubmissionsForStats = (submissions) => {
  const latestMap = getLatestSubmissionMap(submissions);
  
  return Array.from(latestMap.values()).filter(
    s => s.status === 'GRADED' && s.teacher_marks !== undefined && s.teacher_marks !== null
  );
};

/**
 * Calculate average, highest, lowest marks from graded submissions only
 */
export const getMarksStatistics = (submissions) => {
  const gradedSubmissions = getGradedSubmissionsForStats(submissions);
  
  if (gradedSubmissions.length === 0) {
    return { averageMarks: null, highestMarks: null, lowestMarks: null };
  }
  
  const marks = gradedSubmissions.map(s => Number(s.teacher_marks));
  
  return {
    averageMarks: marks.reduce((a, b) => a + b, 0) / marks.length,
    highestMarks: Math.max(...marks),
    lowestMarks: Math.min(...marks)
  };
};