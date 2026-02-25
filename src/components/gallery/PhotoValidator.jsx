/**
 * Validates photo URLs
 */
export function isValidPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.trim().length > 0;
}

/**
 * Returns the trimmed URL as-is. Both base44.app proxy URLs and 
 * direct Supabase URLs are valid and serve files correctly.
 */
export function cleanPhotoUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}