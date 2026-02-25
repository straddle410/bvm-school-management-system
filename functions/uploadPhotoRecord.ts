import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const reqData = await req.json();
        
        // Verify user exists in StaffAccount or User to prevent unauthorized uploads
        const [staff, users] = await Promise.all([
            base44.asServiceRole.entities.StaffAccount.filter({email: reqData.uploaded_by}),
            base44.asServiceRole.entities.User.filter({email: reqData.uploaded_by})
        ]);
        
        if (staff.length === 0 && users.length === 0 && reqData.uploaded_by !== 'system') {
             return Response.json({ error: 'Invalid user email. Upload not allowed.' }, { status: 403 });
        }

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