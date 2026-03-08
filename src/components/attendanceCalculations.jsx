/**
 * Shared attendance calculation utilities.
 * Single source of truth for percentage calculations across the app.
 */

/**
 * Calculate raw attendance percentage (0-100).
 * @param {number} presentDays - Total present days (full days + 0.5 per half day)
 * @param {number} workingDays - Total working days
 * @returns {number} Percentage (0-100)
 */
export function calculateAttendancePercentage(presentDays, workingDays) {
  if (workingDays === 0) return 0;
  return (presentDays / workingDays) * 100;
}

/**
 * Format attendance percentage for display.
 * Uses Math.round() for consistency across all views (student + admin).
 * @param {number} percentage - Raw percentage (0-100)
 * @returns {number} Rounded to nearest integer
 */
export function formatAttendancePercentage(percentage) {
  return Math.round(percentage);
}

/**
 * Calculate and format attendance percentage in one step.
 * @param {number} presentDays - Total present days
 * @param {number} workingDays - Total working days
 * @returns {number} Formatted percentage
 */
export function getAttendancePercentage(presentDays, workingDays) {
  const raw = calculateAttendancePercentage(presentDays, workingDays);
  return formatAttendancePercentage(raw);
}

/**
 * CANONICAL DEDUPLICATION RULE FOR ATTENDANCE RECORDS
 * 
 * For duplicate Attendance records on the same (date, student_id, class_name, section, academic_year),
 * select the most recent by updated_date, or created_date if updated_date is missing/equal.
 * 
 * This ensures consistent duplicate resolution across all screens:
 * - Mark Attendance
 * - Summary Report
 * - Daily Snapshot
 * 
 * @param {Array} attendanceRecords - Array of Attendance entities
 * @returns {Array} Deduplicated records (one per date+student+class+section)
 */
export function deduplicateAttendanceRecords(attendanceRecords) {
  if (!attendanceRecords || attendanceRecords.length === 0) {
    return [];
  }

  // Group by: academic_year + date + class_name + section + student_id
  const groupMap = {};

  attendanceRecords.forEach(record => {
    const key = `${record.academic_year}|${record.date}|${record.class_name}|${record.section}|${record.student_id}`;
    
    if (!groupMap[key]) {
      groupMap[key] = record;
    } else {
      // Compare timestamps: prefer most recent updated_date, then created_date
      const existing = groupMap[key];
      const existingTime = new Date(existing.updated_date || existing.updated_at || existing.created_date || existing.created_at).getTime();
      const newTime = new Date(record.updated_date || record.updated_at || record.created_date || record.created_at).getTime();

      if (newTime > existingTime) {
        // Log duplicate detection for debugging
        if (typeof console !== 'undefined' && console.warn) {
          console.warn(
            `[Attendance Dedup] Duplicate records for ${record.student_id} on ${record.date} ` +
            `in ${record.class_name}-${record.section}. Using record with updated_date: ${new Date(newTime).toISOString()}`
          );
        }
        groupMap[key] = record;
      } else if (newTime === existingTime && record.id > existing.id) {
        // Stable fallback: if timestamps equal, use lexicographically larger id
        groupMap[key] = record;
      }
    }
  });

  return Object.values(groupMap);
}