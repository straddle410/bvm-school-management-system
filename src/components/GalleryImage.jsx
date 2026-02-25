import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  
  React.useEffect(() => {
    setHasError(false);
  }, [src]);
  
  // Validate URL - check if src exists and is a valid string
  const isValidUrl = src && typeof src === 'string' && src.trim().length > 0;

  // Show placeholder if URL is invalid or missing
  if (!isValidUrl || hasError) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`} onClick={onClick}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  const finalSrc = src?.trim() || '';

  return (
    <img
      src={finalSrc}
      alt={alt || ''}
      loading={loading}
      className={className}
      onClick={onClick}
      onError={(e) => {
        console.error('Image failed to load:', src);
        setHasError(true);
      }}
    />
  );
}