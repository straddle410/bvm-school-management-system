import { normalizeHomeworkSubmissionStatus } from '@/components/utils/homeworkStatusHelper';

/**
 * Get the latest/current submission for each student.
 * For each student_id, keeps only the most recent submission by timestamp.
 * 
 * @param {Array} submissions - Array of HomeworkSubmission records
 * @returns {Map} Map with student_id as key, latest submission record as value
 */
export function getLatestSubmissionPerStudent(submissions) {
  const latestMap = new Map();
  
  submissions.forEach((sub) => {
    const current = latestMap.get(sub.student_id);
    
    // If no prior submission or this one is more recent, update
    if (!current) {
      latestMap.set(sub.student_id, sub);
    } else {
      const currentTime = new Date(current.submitted_at || current.updated_at || 0).getTime();
      const newTime = new Date(sub.submitted_at || sub.updated_at || 0).getTime();
      
      if (newTime > currentTime) {
        latestMap.set(sub.student_id, sub);
      }
    }
  });
  
  return latestMap;
}

/**
 * Calculate aggregated metrics for a homework assignment.
 * Single source of truth for all dashboard metrics.
 * 
 * @param {Object} homework - Homework record
 * @param {Array} submissions - All HomeworkSubmission records for this homework
 * @param {Array} assignedStudents - Array of Student records assigned to this homework
 * @returns {Object} Aggregated metrics including submitted, graded, etc.
 */
export function getHomeworkAggregatedMetrics(homework, submissions, assignedStudents) {
  // ✅ CRITICAL: Never calculate submission metrics for VIEW_ONLY homework
  if (homework.submission_mode === 'VIEW_ONLY') {
    return {
      totalStudents: assignedStudents.length,
      submittedCount: 0,
      pendingCount: 0,
      gradedCount: 0,
      revisionRequiredCount: 0,
      lateCount: 0,
      completionPercent: 0,
      averageMarks: null,
      highestMarks: null,
      lowestMarks: null,
      latestSubmissionMap: new Map(),
    };
  }

  // SUBMISSION_REQUIRED: calculate submission metrics normally
  const hwSubmissions = submissions.filter(s => s.homework_id === homework.id);
  
  // Get latest submission per student
  const latestMap = getLatestSubmissionPerStudent(hwSubmissions);
  
  // Normalize all statuses
  const latestByStatus = new Map();
  latestMap.forEach((sub, studentId) => {
    const normalized = normalizeHomeworkSubmissionStatus(sub.status);
    latestByStatus.set(studentId, {
      ...sub,
      status: normalized,
      normalizedStatus: normalized
    });
  });
  
  // Count students by status (using latest submission only)
  const submittedCount = Array.from(latestByStatus.values()).filter(
    s => s.normalizedStatus === 'SUBMITTED' || s.normalizedStatus === 'RESUBMITTED'
  ).length;
  
  const gradedCount = Array.from(latestByStatus.values()).filter(
    s => s.normalizedStatus === 'GRADED'
  ).length;
  
  const revisionRequiredCount = Array.from(latestByStatus.values()).filter(
    s => s.normalizedStatus === 'REVISION_REQUIRED'
  ).length;
  
  // Late count: unique students whose latest submission is late
  const lateCount = Array.from(latestByStatus.values()).filter(
    s => s.is_late === true
  ).length;
  
  // Total and pending
  const totalStudents = assignedStudents.length;
  const totalUniqueSubmitted = latestByStatus.size;
  const pendingCount = Math.max(0, totalStudents - totalUniqueSubmitted);
  
  // Completion percentage
  const completionPercent = totalStudents > 0 
    ? Math.round((totalUniqueSubmitted / totalStudents) * 100)
    : 0;
  
  // Marks statistics (GRADED submissions only)
  const gradedSubmissionsWithMarks = Array.from(latestByStatus.values()).filter(
    s => s.normalizedStatus === 'GRADED' && s.teacher_marks !== undefined && s.teacher_marks !== null
  );
  
  const averageMarks = gradedSubmissionsWithMarks.length > 0
    ? gradedSubmissionsWithMarks.reduce((sum, s) => sum + Number(s.teacher_marks), 0) / gradedSubmissionsWithMarks.length
    : null;
  
  const highestMarks = gradedSubmissionsWithMarks.length > 0
    ? Math.max(...gradedSubmissionsWithMarks.map(s => Number(s.teacher_marks)))
    : null;
  
  const lowestMarks = gradedSubmissionsWithMarks.length > 0
    ? Math.min(...gradedSubmissionsWithMarks.map(s => Number(s.teacher_marks)))
    : null;
  
  return {
    totalStudents,
    submittedCount,
    pendingCount,
    gradedCount,
    revisionRequiredCount,
    lateCount,
    completionPercent,
    averageMarks,
    highestMarks,
    lowestMarks,
    // Return the latest map for use in filters/segmentation
    latestSubmissionMap: latestByStatus,
  };
}