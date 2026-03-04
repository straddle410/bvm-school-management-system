import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (user.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Forbidden: Admin/Principal only' }, { status: 403 });
    }

    const { noticeId, reason } = await req.json();
    if (!noticeId) {
      return Response.json({ error: 'noticeId required' }, { status: 400 });
    }

    const notice = await base44.entities.Notice.get(noticeId);
    if (!notice) {
      return Response.json({ error: 'Notice not found' }, { status: 404 });
    }

    if (notice.status !== 'PendingApproval') {
      return Response.json({ error: `Cannot reject from ${notice.status} status` }, { status: 400 });
    }

    await base44.entities.Notice.update(noticeId, { 
      status: 'Draft',
      rejection_reason: reason || null,
      rejected_at: new Date().toISOString()
    });
    
    return Response.json({ success: true, status: 'Draft', reason });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});