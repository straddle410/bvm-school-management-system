// sessionHelper.js
// Dual-storage session management: localStorage + cookies
// iOS Safari PWA can clear localStorage; cookies persist much better.

const COOKIE_EXPIRY_DAYS = 60;

function setCookie(name, value, days) {
  try {
    const expires = new Date(Date.now() + days * 86400000).toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
  } catch {}
}

function getCookie(name) {
  try {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  } catch {
    return null;
  }
}

function deleteCookie(name) {
  try {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  } catch {}
}

// Save session to both localStorage AND cookie
export function saveSession(key, data) {
  try {
    const fullValue = JSON.stringify(data);
    try { localStorage.setItem(key, fullValue); } catch {}

    // For cookie, strip large fields to stay under 4KB limit
    const cookieData = { ...data };
    if (key === 'student_session') {
      delete cookieData.photo_url; // can be a large URL
    }
    const cookieValue = JSON.stringify(cookieData);
    // Only store in cookie if under 3.8KB
    if (cookieValue.length < 3800) {
      setCookie(key, cookieValue, COOKIE_EXPIRY_DAYS);
    } else {
      // Store minimal identity fields only
      const minData = key === 'student_session'
        ? { id: data.id, student_id: data.student_id, name: data.name, class_name: data.class_name, section: data.section, academic_year: data.academic_year, roll_no: data.roll_no }
        : { staff_id: data.staff_id, username: data.username, name: data.name, role: data.role, staff_session_token: data.staff_session_token, token_exp: data.token_exp };
      setCookie(key, JSON.stringify(minData), COOKIE_EXPIRY_DAYS);
    }
  } catch {}
}

// Get session: localStorage first, then cookie fallback (restores to localStorage for subsequent reads)
export function getSession(key) {
  // Try localStorage first
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Validate it has identity fields
      if (parsed && (parsed.student_id || parsed.username || parsed.staff_id || parsed.id)) {
        return parsed;
      }
    }
  } catch {}

  // Fallback to cookie — iOS PWA may have cleared localStorage
  try {
    const raw = getCookie(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.student_id || parsed.username || parsed.staff_id || parsed.id)) {
        // Restore to localStorage so direct localStorage reads by other pages also work
        try { localStorage.setItem(key, raw); } catch {}
        return parsed;
      }
    }
  } catch {}

  return null;
}

// Clear session from both localStorage AND cookie (use on logout)
export function clearSession(key) {
  try { localStorage.removeItem(key); } catch {}
  deleteCookie(key);
}