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

    // Upload file to private storage and get signed URL
    const uploadRes = await base44.asServiceRole.integrations.Core.UploadPrivateFile({
      file: file_data
    });

    if (!uploadRes || !uploadRes.file_uri) {
      throw new Error('Failed to upload file to storage');
    }

    // Create signed URL for accessing the file
    const signedUrlRes = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({
      file_uri: uploadRes.file_uri,
      expires_in: 31536000 // 1 year
    });

    if (!signedUrlRes || !signedUrlRes.signed_url) {
      throw new Error('Failed to create signed URL');
    }

    // Create photo record in database with signed URL
    const photoRecord = await base44.asServiceRole.entities.GalleryPhoto.create({
      album_id,
      photo_url: signedUrlRes.signed_url,
      caption: caption || '',
      uploaded_by: uploaded_by || (user?.email || 'unknown'),
      status: status || 'Published'
    });

    return Response.json({ success: true, photo_id: photoRecord.id, photo_url: signedUrlRes.signed_url });
  } catch (error) {
    console.error('Upload error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});