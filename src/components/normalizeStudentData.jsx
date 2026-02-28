/**
 * Case normalization utilities for the Student module.
 * Rule:
 *   - identifiers (student_id, username) → UPPERCASE
 *   - names, general text               → Title Case
 *   - emails                            → lowercase
 *   - passwords                         → UNTOUCHED (only trim outer whitespace)
 *   - all strings                       → trim + collapse internal spaces
 */

const toTitleCase = (str) => {
  if (!str) return str;
  return str
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
};

const toUpperClean = (str) => {
  if (!str) return str;
  return str.trim().replace(/\s+/g, ' ').toUpperCase();
};

const toLowerClean = (str) => {
  if (!str) return str;
  return str.trim().replace(/\s+/g, ' ').toLowerCase();
};

const cleanText = (str) => {
  if (!str) return str;
  return str.trim().replace(/\s+/g, ' ');
};

/**
 * Normalize a student data object before saving.
 * Passwords are NEVER modified beyond trimming outer whitespace.
 */
export function normalizeStudentData(data) {
  if (!data) return data;
  const d = { ...data };

  // Identifiers → UPPERCASE
  if (d.student_id) d.student_id = toUpperClean(d.student_id);
  if (d.username)   d.username   = toUpperClean(d.username);

  // Names → Title Case
  if (d.name)            d.name            = toTitleCase(d.name);
  if (d.parent_name)     d.parent_name     = toTitleCase(d.parent_name);
  if (d.previous_school) d.previous_school = toTitleCase(d.previous_school);

  // Address / general text → clean only (preserve mixed case intent)
  if (d.address) d.address = cleanText(d.address);

  // Emails → lowercase
  if (d.parent_email) d.parent_email = toLowerClean(d.parent_email);

  // Password → only trim outer whitespace, never change case
  if (d.password !== undefined && d.password !== null) {
    d.password = String(d.password).trim();
  }

  return d;
}

/**
 * Case-insensitive, whitespace-normalised name comparison.
 * Used in all duplicate checks.
 */
export function namesMatch(a, b) {
  if (!a || !b) return false;
  return a.trim().toLowerCase().replace(/\s+/g, ' ') ===
         b.trim().toLowerCase().replace(/\s+/g, ' ');
}