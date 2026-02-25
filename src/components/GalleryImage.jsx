import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  const [proxiedUrl, setProxiedUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    if (!src) {
      setHasError(true);
      setIsLoading(false);
      return;
    }

    // Try direct URL first
    const img = new Image();
    img.onload = () => {
      setProxiedUrl(src);
      setIsLoading(false);
    };
    img.onerror = () => {
      // If direct URL fails, try proxy
      getProxiedImage();
    };
    img.src = src;
  }, [src]);

  const getProxiedImage = async () => {
    try {
      const response = await base44.functions.invoke('imageProxy', { url: src });
      if (response?.data?.dataUrl) {
        setProxiedUrl(response.data.dataUrl);
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

  if (!src || hasError || (isLoading && !proxiedUrl)) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`} onClick={onClick}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={proxiedUrl}
      alt={alt || ''}
      loading={loading}
      className={className}
      onClick={onClick}
      onError={() => {
        console.error('[GalleryImage] Failed to load:', proxiedUrl);
        setHasError(true);
      }}
    />
  );
}