/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║        GLOBAL STUDENT FILTERING HELPER — MANDATORY PATTERN                ║
 * ╠═══════════════════════════════════════════════════════════════════════════╣
 * ║                                                                           ║
 * ║ CRITICAL: This helper MUST be used for ALL operational student queries   ║
 * ║ outside the Students administration page.                                ║
 * ║                                                                           ║
 * ║ ALLOWED EXCEPTIONS ONLY:                                                 ║
 * │ - pages/Students:     Admin management (shows all statuses)              ║
 * │ - pages/Admissions:   Admission pipeline (pending applications)          ║
 * │ - Admin diagnostic functions: Query all statuses for audit/repair        ║
 * ║                                                                           ║
 * ║ VIOLATION RULES:                                                         ║
 * │ - Direct Student.filter() calls outside allowed pages = ERROR             ║
 * │ - Must use: getActiveStudentFilter() or buildStudentQuery()              ║
 * │ - Enforcement: Code review + test coverage for all operational modules   ║
 * ║                                                                           ║
 * ║ FILTER SPECIFICATION (always applied together):                          ║
 * │ - status: 'Published'     (active enrollment only)                       ║
 * │ - academic_year: currentYear  (current year only)                        ║
 * │ - is_deleted: false       (excludes soft-deleted records)                ║
 * ║                                                                           ║
 * ║ CONSEQUENCE:                                                              ║
 * │ Ensures consistent data visibility across all operational modules.      ║
 * │ Prevents: archived/deleted students, wrong academic years, inactive     ║
 * │ statuses from contaminating attendance, marks, fees, homework, reports. ║
 * ║                                                                           ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
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