import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Detect PWA mode (standalone app)
  const isPWA = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  
  useEffect(() => {
    if (!src) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Always use proxy to handle VPN/network restrictions
    getProxiedImage();
  }, [src]);

  const getProxiedImage = async () => {
    try {
      console.log('[GalleryImage] Calling imageProxy for:', src);
      const response = await base44.functions.invoke('imageProxy', { url: src });
      console.log('[GalleryImage] Proxy response status:', response.status);
      const dataUrl = response?.data?.dataUrl || response?.dataUrl;
      if (dataUrl) {
        console.log('[GalleryImage] Setting dataUrl, length:', dataUrl.length);
        setDisplayUrl(dataUrl);
        setIsLoading(false);
      } else {
        console.error('[GalleryImage] No dataUrl in response', response);
        setHasError(true);
        setIsLoading(false);
      }
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