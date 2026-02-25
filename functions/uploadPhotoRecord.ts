import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const reqData = await req.json();
        
        // Use service role to bypass RLS and create the photo record
        const record = await base44.asServiceRole.entities.GalleryPhoto.create({
            album_id: reqData.album_id,
            photo_url: reqData.photo_url,
            caption: reqData.caption,
            uploaded_by: reqData.uploaded_by,
            status: reqData.status
        });

        return Response.json({ success: true, record });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});