import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user || user.role !== 'admin') {
            return Response.json({ error: 'Admin access required' }, { status: 403 });
        }

        // Get a sample photo to inspect
        const photos = await base44.asServiceRole.entities.GalleryPhoto.filter({}, '', 1);
        
        if (photos.length === 0) {
            return Response.json({ 
                status: 'no_photos',
                message: 'No gallery photos found to test'
            });
        }

        const samplePhoto = photos[0];
        const currentUrl = samplePhoto.photo_url;

        console.log('=== Storage Test ===');
        console.log('Sample photo URL:', currentUrl);
        console.log('URL type:', currentUrl.includes('supabase') ? 'Supabase' : currentUrl.includes('base44.app') ? 'Base44 Proxy' : 'Unknown');

        // Test URL accessibility
        const testUrls = [
            currentUrl,
            ...(currentUrl.includes('supabase') ? [] : [])
        ];

        const results = [];
        for (const url of testUrls) {
            try {
                const testReq = await fetch(url, { method: 'HEAD' });
                results.push({
                    url: url.substring(0, 100) + '...',
                    status: testReq.status,
                    accessible: testReq.ok
                });
            } catch (e) {
                results.push({
                    url: url.substring(0, 100) + '...',
                    error: e.message,
                    accessible: false
                });
            }
        }

        return Response.json({
            status: 'test_complete',
            sample_photo_id: samplePhoto.id,
            current_url_sample: currentUrl.substring(0, 150) + '...',
            url_type: currentUrl.includes('supabase') ? 'Supabase' : 'Base44 Proxy',
            accessibility_tests: results,
            note: 'Use migrateGalleryToBase44 function to migrate all images if needed'
        });

    } catch (error) {
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});