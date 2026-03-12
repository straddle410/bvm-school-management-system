import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { photoId, reason, staffInfo } = await req.json();
    if (!staffInfo || !staffInfo.staff_id) {
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }
    const userRole = (staffInfo.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Forbidden: Admin/Principal only' }, { status: 403 });
    }
    if (!photoId) {
      return Response.json({ error: 'photoId required' }, { status: 400 });
    }

    const photo = await base44.entities.GalleryPhoto.get(photoId);
    if (!photo) {
      return Response.json({ error: 'Photo not found' }, { status: 404 });
    }

    if (photo.status !== 'PendingApproval') {
      return Response.json({ error: `Cannot reject from ${photo.status} status` }, { status: 400 });
    }

    await base44.entities.GalleryPhoto.update(photoId, { 
      status: 'Draft',
      rejection_reason: reason || null,
      rejected_at: new Date().toISOString()
    });
    
    return Response.json({ success: true, status: 'Draft', reason });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});