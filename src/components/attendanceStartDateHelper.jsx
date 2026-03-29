/**
 * Helper to determine the effective attendance start date for a student.
 * 
 * Rules:
 * 1. If student has an admission_date → use that
 * 2. If no admission_date → use academic year's start_date
 * 
 * This ensures:
 * - Promoted students (no admission_date) are calculated from academic year start
 * - Mid-year joiners (with admission_date) are calculated from their admission date
 */

/**
 * Get the effective attendance start date for a student.
 * 
 * @param {Object} student - Student entity with optional admission_date
 * @param {string} academicYearStartDate - Academic year start date (YYYY-MM-DD)
 * @returns {string} Effective start date (YYYY-MM-DD)
 */
export function getStudentAttendanceStartDate(student, academicYearStartDate) {
  if (!student) {
    return academicYearStartDate;
  }
  
  // If student has an admission_date, use it as the start date
  if (student.admission_date) {
    return student.admission_date;
  }
  
  // Otherwise, default to academic year start date
  return academicYearStartDate;
}