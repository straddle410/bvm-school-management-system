import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all gallery photos
    const allPhotos = await base44.asServiceRole.entities.GalleryPhoto.list();
    
    let migratedCount = 0;
    const results = [];

    for (const photo of allPhotos) {
      const url = photo.photo_url;
      
      // Check if it's a Supabase URL that needs migration
      if (url && url.includes('supabase.co')) {
        try {
          // Extract filename from Supabase URL
          // Format: https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/{app_id}/{filename}
          const parts = url.split('/');
          const filename = parts[parts.length - 1];
          const appId = parts[parts.length - 2];
          
          // Build new Base44 URL
          const newUrl = `https://base44.app/api/apps/${appId}/files/public/${appId}/${filename}`;
          
          // Update the photo
          await base44.asServiceRole.entities.GalleryPhoto.update(photo.id, {
            photo_url: newUrl
          });
          
          migratedCount++;
          results.push({
            id: photo.id,
            oldUrl: url,
            newUrl: newUrl,
            status: 'migrated'
          });
        } catch (error) {
          results.push({
            id: photo.id,
            oldUrl: url,
            status: 'error',
            error: error.message
          });
        }
      }
    }

    return Response.json({
      success: true,
      totalPhotos: allPhotos.length,
      migratedCount,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});