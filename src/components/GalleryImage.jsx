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

    // In PWA mode, use fetch blob strategy to bypass service worker caching
    if (isPWA()) {
      loadImageViaBlobUrl();
      return;
    }

    // In browser, try direct URL first
    const img = new Image();
    img.onload = () => {
      setDisplayUrl(src);
      setIsLoading(false);
    };
    img.onerror = () => {
      // If direct URL fails, try proxy
      getProxiedImage();
    };
    img.src = src;
  }, [src]);

  const loadImageViaBlobUrl = async () => {
    try {
      // Add timestamp to bust any caching on iOS PWA
      const cacheBustUrl = src + (src.includes('?') ? '&' : '?') + 't=' + Date.now();
      const response = await fetch(cacheBustUrl, { 
        cache: 'no-store',
        credentials: 'include',
        mode: 'cors'
      });
      if (!response.ok) throw new Error('Failed to fetch image');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      setDisplayUrl(blobUrl);
      setIsLoading(false);
    } catch (error) {
      console.error('[GalleryImage] Blob load failed:', error);
      // Fallback to proxy for iOS PWA
      getProxiedImage();
    }
  };

  const getProxiedImage = async () => {
    try {
      const response = await base44.functions.invoke('imageProxy', { url: src });
      if (response?.data?.dataUrl) {
        setDisplayUrl(response.data.dataUrl);
      } else {
        setHasError(true);
      }
    } catch (error) {
      console.error('[GalleryImage] Proxy error:', error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (!src || hasError || (isLoading && !displayUrl)) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`} onClick={onClick}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
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
    />
  );
}