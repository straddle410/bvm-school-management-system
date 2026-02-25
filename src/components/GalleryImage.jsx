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

  return (
    <img
      src={src}
      alt={alt || ''}
      loading={loading}
      className={className}
      onClick={onClick}
      onLoad={() => console.log('[GalleryImage] Loaded:', src)}
      onError={(e) => {
        console.error('[GalleryImage] Failed to load:', src, e);
        setHasError(true);
      }}
    />
  );
}