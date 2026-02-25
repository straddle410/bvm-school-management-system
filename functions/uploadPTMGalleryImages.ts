import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find or create PTM album
    let albums = await base44.entities.EventAlbum.filter({ name: 'PTM' });
    let ptmAlbum = albums[0];

    if (!ptmAlbum) {
      ptmAlbum = await base44.entities.EventAlbum.create({
        name: 'PTM',
        description: 'Parent Teacher Meeting',
        visibility: ['Public', 'Staff Only', 'Students & Parents'],
        status: 'Published'
      });
    }

    // Image URLs
    const images = [
      {
        url: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/c95d41e0e_APPICON.png',
        caption: 'BVM School Icon'
      },
      {
        url: 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/69965572f33252d650e49c9b/60e6f813c_lOGO.jpeg',
        caption: 'BVM School Logo'
      }
    ];

    // Add images to gallery
    let created = 0;
    for (const img of images) {
      await base44.entities.GalleryPhoto.create({
        album_id: ptmAlbum.id,
        photo_url: img.url,
        caption: img.caption,
        uploaded_by: user.email,
        status: 'Published'
      });
      created++;
    }

    return Response.json({
      success: true,
      album_name: ptmAlbum.name,
      album_id: ptmAlbum.id,
      images_added: created
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});