import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    const body = await req.json();
    const { file_data, album_id, caption, uploaded_by, status } = body;

    if (!album_id || !file_data) {
      return Response.json({ error: 'Missing album_id or file_data' }, { status: 400 });
    }

    // Upload file to public storage (returns public URL directly)
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({
      file: file_data
    });

    if (!uploadRes || !uploadRes.file_url) {
      throw new Error(`Failed to upload file to storage: ${JSON.stringify(uploadRes)}`);
    }

    const publicUrl = uploadRes.file_url;

    // Create photo record in database with public URL
    const photoRecord = await base44.asServiceRole.entities.GalleryPhoto.create({
      album_id,
      photo_url: publicUrl,
      caption: caption || '',
      uploaded_by: uploaded_by || (user?.email || 'unknown'),
      status: status || 'Published'
    });

    console.log(`[uploadGalleryPhoto] Success: ID=${photoRecord.id}, URL=${publicUrl}`);
    return Response.json({ success: true, photo_id: photoRecord.id, photo_url: publicUrl });
  } catch (error) {
    console.error('[uploadGalleryPhoto] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});