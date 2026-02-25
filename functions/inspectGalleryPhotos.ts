import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all gallery photos
    const allPhotos = await base44.entities.GalleryPhoto.list();

    const broken = [];
    const valid = [];

    allPhotos.forEach(photo => {
      const url = photo.photo_url;
      
      if (!url || url.trim().length === 0) {
        broken.push({
          id: photo.id,
          reason: 'Empty or missing photo_url',
          photo_url: url
        });
      } else if (url.includes('base44.app/api/apps')) {
        broken.push({
          id: photo.id,
          reason: 'Legacy base44.app URL',
          photo_url: url
        });
      } else {
        valid.push({
          id: photo.id,
          photo_url: url.substring(0, 80) + '...'
        });
      }
    });

    return Response.json({
      total: allPhotos.length,
      valid_count: valid.length,
      broken_count: broken.length,
      broken_photos: broken,
      sample_valid: valid.slice(0, 3)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});