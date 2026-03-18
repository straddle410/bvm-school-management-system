import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { photoId } = await req.json();
    if (!photoId) {
      return Response.json({ error: 'photoId required' }, { status: 400 });
    }

    const photo = await base44.entities.GalleryPhoto.get(photoId);
    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    // Only uploader or admin can submit
    if (photo.uploaded_by !== user.email && !['admin', 'principal'].includes((user.role || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (photo.status !== 'Draft') {
      return Response.json({ error: `Cannot submit from ${photo.status} status` }, { status: 400 });
    }

    await base44.entities.GalleryPhoto.update(photoId, { status: 'PendingApproval' });
    
    return Response.json({ success: true, status: 'PendingApproval' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});