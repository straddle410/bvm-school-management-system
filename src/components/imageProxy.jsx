/**
 * Proxies Supabase image URLs through weserv.nl to bypass ISP routing blocks in India.
 * Only applies to public Supabase storage URLs to avoid unnecessary processing.
 * 
 * @param {string} url - The image URL to proxy
 * @returns {string} - The proxied URL or original URL if not a Supabase URL
 */
export function getProxiedImageUrl(url) {
  if (!url) return url;
  
  // Only proxy Supabase storage URLs (base44.app public storage)
  const isSupabaseUrl = url.includes('base44.app') || url.includes('supabase.co');
  
  if (!isSupabaseUrl) {
    return url;
  }
  
  // Return proxied URL through weserv.nl
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
}