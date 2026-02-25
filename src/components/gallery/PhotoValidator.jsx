/**
 * Validates photo URLs - lightweight check after upload completes
 * Only rejects empty/null and legacy base44.app URLs
 */
export function isValidPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  
  // Reject ONLY legacy base44.app URLs - accept everything else from trusted upload service
  if (trimmed.includes('base44.app/api/apps')) {
    return false;
  }
  
  return true;
}

/**
 * Cleans and validates photo URL after upload
 */
export function cleanPhotoUrl(url) {
  if (!url) return null;
  
  const trimmed = url.trim();
  
  if (!isValidPhotoUrl(trimmed)) {
    return null;
  }
  
  return trimmed;
}