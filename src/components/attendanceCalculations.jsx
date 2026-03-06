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