import React, { useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';

function toProxyUrl(url) {
  if (!url) return '';
  const trimmed = url.trim();
  
  // If it's already a base44.app URL, return as-is (handles CORS better)
  if (trimmed.includes('base44.app')) {
    return trimmed;
  }
  
  // Convert Supabase URLs to base44 proxy format
  if (trimmed.includes('supabase.co/storage/v1/object/public/base44-prod/public/')) {
    const parts = trimmed.split('/public/base44-prod/public/');
    if (parts.length === 2) {
      const appPath = parts[1];
      const appId = appPath.split('/')[0];
      return `https://base44.app/api/apps/${appId}/files/public/${appPath}`;
    }
  }
  
  return trimmed;
}

export default function GalleryImage({ src, alt, className, onClick, loading = 'lazy' }) {
  const [hasError, setHasError] = useState(false);
  
  const finalSrc = toProxyUrl(src);

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