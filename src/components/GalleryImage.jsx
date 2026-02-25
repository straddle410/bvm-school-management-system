import React, { useState, useEffect } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  const [proxiedUrl, setProxiedUrl] = useState(null);
  
  useEffect(() => {
    if (!src) {
      setHasError(true);
      return;
    }

    const getProxiedImage = async () => {
      try {
        const response = await base44.functions.invoke('imageProxy', { url: src });
        if (response?.data?.url) {
          setProxiedUrl(response.data.url);
        } else {
          setHasError(true);
        }
      } catch (error) {
        console.error('[GalleryImage] Proxy error:', error);
        setHasError(true);
      }
    };

    getProxiedImage();
  }, [src]);

  if (!src || hasError || !proxiedUrl) {
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
      crossOrigin="anonymous"
      onLoad={() => console.log('[GalleryImage] Loaded:', proxiedUrl)}
      onError={(e) => {
        console.error('[GalleryImage] Failed to load:', proxiedUrl, e);
        setHasError(true);
      }}
    />
  );
}