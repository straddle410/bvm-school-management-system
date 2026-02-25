import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Get all gallery photos
        const allPhotos = await base44.asServiceRole.entities.GalleryPhoto.list();
        
        let converted = 0;
        let skipped = 0;

        for (const photo of allPhotos) {
            const url = photo.photo_url?.trim();
            
            // Skip if URL is already in correct base44.app format or doesn't exist
            if (!url || url.includes('base44.app/api/apps')) {
                skipped++;
                continue;
            }

            // If it's a Supabase URL, convert to base44.app proxy format
            if (url.includes('supabase.co')) {
                const parts = url.split('/public/');
                if (parts.length === 2) {
                    const appPath = parts[1];
                    const appId = appPath.split('/')[0];
                    const newUrl = `https://base44.app/api/apps/${appId}/files/public/${appPath}`;
                    
                    await base44.asServiceRole.entities.GalleryPhoto.update(photo.id, { photo_url: newUrl });
                    converted++;
                    console.log(`Migrated photo ${photo.id}: ${url.substring(0, 80)}... => ${newUrl.substring(0, 80)}...`);
                }
            } else {
                skipped++;
            }
        }

        return Response.json({
            status: 'migration_complete',
            total_photos: allPhotos.length,
            converted: converted,
            skipped: skipped,
            message: `Successfully converted ${converted} Supabase URLs to Base44 format`
        });

    } catch (error) {
        return Response.json({ 
            error: error.message
        }, { status: 500 });
    }
});