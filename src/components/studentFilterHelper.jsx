/**
 * GLOBAL STUDENT FILTERING HELPER
 * 
 * Standard filter rule used across all modules EXCEPT Students page:
 * - status: 'Published' (active enrollment)
 * - academic_year: currentYear (current year only)
 * - is_deleted: false (not soft-deleted)
 * 
 * This ensures consistent data visibility and prevents:
 * - Deleted/archived students from appearing in module operations
 * - Students from wrong academic years
 * - Inactive/pending enrollment statuses
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
  const baseFilter = getActiveStudentFilter(academicYear);
  if (!baseFilter) return null;
  
  // Merge filters - base filter takes precedence
  return {
    ...additionalFilters,
    ...baseFilter  // Override any conflicting filters
  };
};