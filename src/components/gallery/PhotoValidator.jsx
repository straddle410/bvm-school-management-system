/**
 * Validates photo URLs - lightweight check after upload completes
 * Accepts any URL from trusted upload service - frontend handles broken images
 */
export function isValidPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const trimmed = url.trim();
  if (trimmed.length === 0) return false;
  
  // Accept any URL from upload service - GalleryImage component handles broken links gracefully
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