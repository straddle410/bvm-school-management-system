import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  
  if (!src || hasError) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`} onClick={onClick}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  const proxiedUrl = src ? `/api/imageProxy?url=${encodeURIComponent(src)}` : '';

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