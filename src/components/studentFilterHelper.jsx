/**
 * Global Student Filtering Helper
 * 
 * Used across the app (except Students page) to ensure consistent filtering:
 * - Only active/published students
 * - Only current academic year
 * - Excludes soft-deleted students
 * 
 * Filter Rule: { status: 'Published', academic_year: academicYear, is_deleted: false }
 */

export const getActiveStudentFilter = (academicYear) => {
  if (!academicYear) return null;
  return {
    status: 'Published',
    academic_year: academicYear,
    is_deleted: false
  };
};

export const buildStudentQuery = (academicYear, additionalFilters = {}) => {
  return {
    ...getActiveStudentFilter(academicYear),
    ...additionalFilters
  };
};