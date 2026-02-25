/**
 * Validates photo URLs before saving to database
 */
export function isValidPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  
  // Must start with https or http
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return false;
  }
  
  // Reject legacy base44.app URLs
  if (trimmed.includes('base44.app/api/apps')) {
    return false;
  }
  
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates and cleans photo URL
 */
export function cleanPhotoUrl(url) {
  if (!url) return null;
  
  const trimmed = url.trim();
  
  if (!isValidPhotoUrl(trimmed)) {
    return null;
  }
  
  return trimmed;
}