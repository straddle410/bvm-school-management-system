import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  
  const finalSrc = src && typeof src === 'string' ? src.trim() : '';

  if (!finalSrc || hasError) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`} onClick={onClick}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={finalSrc}
      alt={alt || ''}
      loading={loading}
      className={className}
      onClick={onClick}
      onError={() => {
        console.error('[GalleryImage] Failed to load:', finalSrc);
        setHasError(true);
      }}
    />
  );
}