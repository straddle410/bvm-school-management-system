/**
 * Validates photo URLs
 */
export function isValidPhotoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return url.trim().length > 0;
}

/**
 * Fixes known broken URL patterns from the upload service.
 * The UploadFile service sometimes returns base44.app/api/apps/... URLs
 * which don't resolve. This maps them to the correct Supabase storage URLs.
 */
export function cleanPhotoUrl(url) {
  if (!url) return null;
  
  let trimmed = url.trim();
  if (!trimmed) return null;

  // Fix base44.app/api/apps URLs → Supabase storage URLs
  const base44Pattern = /^https?:\/\/base44\.app\/api\/apps\/([^/]+)\/files\/public\/([^/]+)\/(.+)$/;
  const match = trimmed.match(base44Pattern);
  if (match) {
    const appId = match[1];
    const folder = match[2];
    const filename = match[3];
    trimmed = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/${folder}/${filename}`;
    console.log('[PhotoValidator] Fixed URL:', url, '->', trimmed);
  }
  
  return trimmed;
}