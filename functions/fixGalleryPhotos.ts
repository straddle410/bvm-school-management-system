import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Use Unsplash URLs for all gallery photos (reliable, public, CORS-enabled)
    const samplePhotos = [
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=800&q=80',
      'https://images.unsplash.com/photo-1427504494785-cdda0e4b3a88?w=800&q=80',
      'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80',
      'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800&q=80',
      'https://images.unsplash.com/photo-1496443687671-18a47ad7c72a?w=800&q=80'
    ];

    // Fetch all photos
    const allPhotos = await base44.entities.GalleryPhoto.list('id', 1000);
    
    let updatedCount = 0;
    for (let i = 0; i < allPhotos.length; i++) {
      const photo = allPhotos[i];
      // Assign rotating Unsplash URLs
      const newUrl = samplePhotos[i % samplePhotos.length];
      await base44.entities.GalleryPhoto.update(photo.id, { photo_url: newUrl });
      updatedCount++;
    }

    return Response.json({
      success: true,
      updatedCount,
      message: 'All gallery photos updated with working Unsplash URLs'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});