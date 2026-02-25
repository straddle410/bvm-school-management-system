import { createClientFromRequest } from 'npm:@base44/sdk@0.8.18';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        let user = null;
        try {
            user = await base44.auth.me();
        } catch (e) {
            console.log("Auth error:", e);
        }

        return Response.json({ user });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});