/**
 * Returns the currently logged-in staff member from localStorage,
 * or null if not logged in via the custom staff login.
 */
export function getStaffSession() {
  try {
    const session = localStorage.getItem('staff_session');
    if (session) return JSON.parse(session);
  } catch {}
  return null;
}

export function clearStaffSession() {
  localStorage.removeItem('staff_session');
}