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
    
    for (const photo of allPhotos) {
      if (!photo.photo_url || !photo.photo_url.includes('base44.app')) {
        continue;
      }
      
      try {
        // Extract the filename from the URL
        const match = photo.photo_url.match(/files\/public\/[^/]+\/(.+)$/);
        if (!match) continue;
        
        const filename = match[1];
        
        // Convert to Supabase CDN URL
        // Format: https://[PROJECT_ID].supabase.co/storage/v1/object/public/[BUCKET]/[PATH]
        const newUrl = `https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/${filename}`;
        
        await base44.entities.GalleryPhoto.update(photo.id, { photo_url: newUrl });
        migratedPhotos.push({ id: photo.id, oldUrl: photo.photo_url, newUrl });
      } catch (e) {
        console.error(`Failed to migrate photo ${photo.id}:`, e.message);
      }
    }

    return Response.json({
      success: true,
      migratedCount: migratedPhotos.length,
      photos: migratedPhotos
    });
  } catch (error) {
    console.error('Migration error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});