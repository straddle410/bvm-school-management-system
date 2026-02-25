import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

function fixPhotoUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  
  // Fix base44.app/api/apps URLs → Supabase storage URLs
  const base44Pattern = /^https?:\/\/base44\.app\/api\/apps\/([^/]+)\/files\/public\/([^/]+)\/(.+)$/;
  const match = trimmed.match(base44Pattern);
  if (match) {
    return `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/${match[2]}/${match[3]}`;
  }
  
  return trimmed;
}

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  
  const fixedSrc = fixPhotoUrl(src);
  
  React.useEffect(() => {
    setHasError(false);
  }, [fixedSrc]);
  
  const isValidUrl = fixedSrc && fixedSrc.length > 0;

  if (!isValidUrl || hasError) {
    return (
      <div className={`${className} bg-gray-200 flex items-center justify-center`} onClick={onClick}>
        <ImageIcon className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={fixedSrc}
      alt={alt || ''}
      loading={loading}
      className={className}
      onClick={onClick}
      onError={(e) => {
        console.error('Image failed to load:', fixedSrc);
        setHasError(true);
      }}
    />
  );
}