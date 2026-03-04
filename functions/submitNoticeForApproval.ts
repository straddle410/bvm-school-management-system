import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { noticeId } = await req.json();
    if (!noticeId) {
      return Response.json({ error: 'noticeId required' }, { status: 400 });
    }

    const notice = await base44.entities.Notice.get(noticeId);
    if (!notice) {
      return Response.json({ error: 'Notice not found' }, { status: 404 });
    }

    // Only teacher who created or admin can submit
    const isCreator = notice.created_by_name && user.full_name && notice.created_by_name.includes((user.full_name || user.email));
    const isAdmin = ['admin', 'principal'].includes((user.role || '').toLowerCase());
    
    if (!isCreator && !isAdmin) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Can only submit from Draft status
    if (notice.status !== 'Draft') {
      return Response.json({ error: `Cannot submit from ${notice.status} status` }, { status: 400 });
    }

    await base44.entities.Notice.update(noticeId, { status: 'PendingApproval' });
    
    return Response.json({ success: true, status: 'PendingApproval' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});