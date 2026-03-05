/**
 * HARD BLOCK: StudentAuthGuard
 * =============================
 * 
 * This centralized guard prevents EVERY student from calling base44.auth.me()
 * even if future components accidentally try to use it.
 * 
 * Students authenticate via session only (localStorage.student_session).
 * Any attempt to call auth.me() for a student is a bug and must be blocked.
 */

import { base44 } from '@/api/base44Client';

const STUDENT_SESSION_KEY = 'student_session';

/**
 * Check if current user is a student (by session presence)
 */
function isStudentSession() {
  try {
    const session = localStorage.getItem(STUDENT_SESSION_KEY);
    return !!session;
  } catch {
    return false;
  }
}

/**
 * Wrap base44.auth.me() to hard-block students
 * OVERRIDE USAGE:
 *   Instead of: const user = await base44.auth.me();
 *   Use:        const user = await getAuthenticatedUser();
 * 
 * This ensures students get a graceful null return instead of 401.
 */
export async function getAuthenticatedUser() {
  // Hard block: If student session exists, NEVER call /me
  if (isStudentSession()) {
    console.warn('[StudentAuthGuard] Blocked base44.auth.me() for student session. Returning null.');
    return null;
  }

  // Safe for staff/admin to call auth.me()
  try {
    return await base44.auth.me();
  } catch (error) {
    console.error('[StudentAuthGuard] base44.auth.me() error:', error.message);
    return null;
  }
}

/**
 * Check if current session is student-only (no staff/admin auth)
 */
export function hasStudentSession() {
  return isStudentSession();
}

/**
 * Get student session if exists, otherwise null
 */
export function getStudentSession() {
  try {
    const raw = localStorage.getItem(STUDENT_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Log all calls to auth.me() for debugging
 * (Optional: remove in production)
 */
export function logAuthAttempt(source) {
  if (isStudentSession()) {
    console.warn(
      `[StudentAuthGuard] auth.me() call attempted from ${source} in STUDENT session. This is a bug.`
    );
  }
}