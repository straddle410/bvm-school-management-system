import React, { useState, useMemo } from 'react';
import { Image as ImageIcon } from 'lucide-react';

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  
  const finalSrc = useMemo(() => {
    if (!src || typeof src !== 'string') return '';
    const trimmed = src.trim();
    if (!trimmed) return '';
    
    // Fix legacy base44.app/api/apps URLs → correct Supabase storage URLs
    if (trimmed.includes('base44.app/api/apps')) {
      const parts = trimmed.split('/files/public/');
      if (parts.length === 2) {
        const newUrl = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/${parts[1]}`;
        console.log('[GalleryImage] URL remapped:', trimmed.substring(0, 60), '->', newUrl.substring(0, 60));
        return newUrl;
      }
    }
    
    return trimmed;
  }, [src]);
  
  React.useEffect(() => {
    setHasError(false);
  }, [finalSrc]);

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