import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { folder = 'inbox', limit = 50, cursor = null } = payload;

    if (!['inbox', 'sent'].includes(folder)) {
      return Response.json({ error: 'Invalid folder' }, { status: 400 });
    }

    let query = {};

    if (folder === 'inbox') {
      // Only messages where I'm the recipient
      query = {
        recipient_id: user.email,
        recipient_type: 'individual',
      };
    } else if (folder === 'sent') {
      // Only messages where I'm the sender
      query = {
        sender_id: user.email,
      };
    }

    // Fetch with service role to bypass RLS, then filter server-side
    const allMessages = await base44.asServiceRole.entities.Message.filter(query);

    // Sort by created_date descending, apply cursor/limit
    const sorted = allMessages.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    
    let start = 0;
    if (cursor) {
      start = sorted.findIndex(m => m.id === cursor);
      if (start > -1) start += 1;
    }

    const messages = sorted.slice(start, start + limit);
    const nextCursor = messages.length === limit && start + limit < sorted.length ? messages[messages.length - 1].id : null;

    return Response.json({ messages, nextCursor });
  } catch (error) {
    console.error('Error in listMyMessages:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});