import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const photos = await base44.entities.GalleryPhoto.filter({}, '-created_date', 10);
    
    const debug = photos.map(p => ({
      id: p.id,
      caption: p.caption,
      url: p.photo_url,
      status: p.status,
      urlLength: p.photo_url?.length || 0,
      urlTrimmed: p.photo_url?.trim() || '',
      isTrimmed: p.photo_url !== p.photo_url?.trim()
    }));

    return Response.json({ debug, total: photos.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});