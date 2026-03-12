import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { getProxiedImageUrl } from '@/components/imageProxy';

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Detect PWA mode (standalone app)
  const isPWA = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  
  useEffect(() => {
    console.log('[GalleryImage] useEffect running. src:', src);
    if (!src) {
      console.log('[GalleryImage] No src, setting error');
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Apply proxy to Supabase URLs, use original for others
    console.log('[GalleryImage] About to call getProxiedImage');
    getProxiedImage();
  }, [src]);

  const getProxiedImage = async () => {
    try {
      // Use weserv.nl proxy for base44.app URLs
      const proxiedUrl = getProxiedImageUrl(src);
      console.log('[GalleryImage] Using proxied URL:', proxiedUrl);
      setDisplayUrl(proxiedUrl);
      setIsLoading(false);
    } catch (error) {
      console.error('[GalleryImage] Proxy error:', error.message || error);
      setHasError(true);
      setIsLoading(false);
    }
  };

  if (!src || hasError) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`} onClick={onClick}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  // Show placeholder while loading
  if (isLoading && !displayUrl) {
    return (
      <div className={`${className} bg-gray-100 flex items-center justify-center animate-pulse`} onClick={onClick}>
        <div className="h-8 w-8 bg-gray-300 rounded" />
      </div>
    );
  }

  return (
     <img
       src={displayUrl}
       alt={alt || ''}
       loading={loading}
       width="800"
       height="600"
       className={className}
       onClick={onClick}
       onError={() => {
         console.error('[GalleryImage] Failed to load:', displayUrl);
         setHasError(true);
       }}
       style={{ display: 'block' }}
     />
   );
}