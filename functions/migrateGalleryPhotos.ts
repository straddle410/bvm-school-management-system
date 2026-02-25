import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all photos with old URLs
    const allPhotos = await base44.entities.GalleryPhoto.list('id', 1000);
    
    const migratedPhotos = [];
    const skippedPhotos = [];
    
    for (const photo of allPhotos) {
      if (!photo.photo_url) {
        continue;
      }
      
      // If already has valid Unsplash URL, skip
      if (photo.photo_url.includes('unsplash.com')) {
        skippedPhotos.push({ id: photo.id, reason: 'Already Unsplash URL' });
        continue;
      }
      
      // If has base44.app URL, keep it as-is (files still exist on Base44 storage)
      if (photo.photo_url.includes('base44.app')) {
        skippedPhotos.push({ id: photo.id, reason: 'Base44 URL (native storage)' });
        continue;
      }
      
      // Otherwise convert to valid Supabase URL
      try {
        const match = photo.photo_url.match(/files\/public\/[^/]+\/(.+)$/);
        if (!match) {
          skippedPhotos.push({ id: photo.id, reason: 'Cannot parse URL' });
          continue;
        }
        
        const filename = match[1];
        const newUrl = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/${filename}`;
        
        await base44.entities.GalleryPhoto.update(photo.id, { photo_url: newUrl });
        migratedPhotos.push({ id: photo.id, newUrl });
      } catch (e) {
        console.error(`Failed to migrate photo ${photo.id}:`, e.message);
      }
    }

    return Response.json({
      success: true,
      migratedCount: migratedPhotos.length,
      skippedCount: skippedPhotos.length,
      migratedPhotos: migratedPhotos,
      skippedPhotos: skippedPhotos
    });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});