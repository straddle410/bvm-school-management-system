import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json();
    const { album_id, photo_url, caption, uploaded_by, status } = body;

    if (!album_id || !photo_url) {
      return Response.json({ error: 'Missing album_id or photo_url' }, { status: 400 });
    }

    // Create photo record in database with provided URL
    const photoRecord = await base44.asServiceRole.entities.GalleryPhoto.create({
      album_id,
      photo_url,
      caption: caption || '',
      uploaded_by: uploaded_by || (user?.email || 'unknown'),
      status: status || 'Published'
    });

    console.log(`[uploadGalleryPhoto] Success: ID=${photoRecord.id}, URL=${photo_url}`);
    return Response.json({ success: true, photo_id: photoRecord.id, photo_url });
  } catch (error) {
    console.error('[uploadGalleryPhoto] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});