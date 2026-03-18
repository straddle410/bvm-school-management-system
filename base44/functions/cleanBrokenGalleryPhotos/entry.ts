import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const unsplashUrls = [
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80',
      'https://images.unsplash.com/photo-1427504494785-cdda0e4b3a88?w=1200&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1200&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80',
      'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=1200&q=80',
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200&q=80'
    ];

    // Fetch all photos
    const allPhotos = await base44.entities.GalleryPhoto.list();

    let fixed = 0;
    let deleted = 0;

    for (const photo of allPhotos) {
      const url = photo.photo_url;
      
      // Delete legacy base44.app URLs
      if (url && url.includes('base44.app/api/apps')) {
        await base44.entities.GalleryPhoto.delete(photo.id);
        deleted++;
      }
    }

    // Fetch remaining photos to see how many we need
    const remainingPhotos = await base44.entities.GalleryPhoto.list();
    
    // If we deleted some, add replacements with valid Unsplash URLs
    if (deleted > 0) {
      for (let i = 0; i < deleted; i++) {
        const randomUrl = unsplashUrls[i % unsplashUrls.length];
        await base44.entities.GalleryPhoto.create({
          album_id: remainingPhotos[0]?.album_id || 'default',
          photo_url: randomUrl,
          caption: 'Gallery photo',
          uploaded_by: user.email,
          status: 'Published'
        });
        fixed++;
      }
    }

    return Response.json({
      success: true,
      deleted: deleted,
      replaced: fixed,
      message: `Cleaned up ${deleted} broken photos and replaced with valid Unsplash URLs`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});