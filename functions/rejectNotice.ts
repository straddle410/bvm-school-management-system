import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { noticeId, reason, staffInfo } = await req.json();
    if (!staffInfo || !staffInfo.staff_id) {
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }
    const userRole = (staffInfo.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Forbidden: Admin/Principal only' }, { status: 403 });
    }
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