import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
        return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // Fix Manya Chopra (id: 69a314c8e1f2f4c217f7a222) - deleted student with duplicate student_id S25005
    await base44.asServiceRole.entities.Student.update('69a314c8e1f2f4c217f7a222', {
        student_id: 'S25005-DEL',
        username: 'manya.chopra.del'
    });

    return Response.json({ success: true, message: 'Fixed: Manya Chopra student_id updated to S25005-DEL' });
});