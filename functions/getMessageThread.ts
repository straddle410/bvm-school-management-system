import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { thread_id, parent_message_id } = payload;

    if (!thread_id && !parent_message_id) {
      return Response.json({ error: 'thread_id or parent_message_id required' }, { status: 400 });
    }

    // Fetch all messages in thread via service role
    const allMessages = await base44.asServiceRole.entities.Message.filter({
      thread_id: thread_id || parent_message_id,
    });

    // Filter: only messages where user is sender OR recipient
    const accessibleMessages = allMessages.filter(m => 
      m.sender_id === user.email || m.recipient_id === user.email
    );

    if (accessibleMessages.length === 0) {
      return Response.json({ error: 'Forbidden: No access to this thread' }, { status: 403 });
    }

    // Sort chronologically
    const sorted = accessibleMessages.sort((a, b) => 
      new Date(a.created_date) - new Date(b.created_date)
    );

    return Response.json({ messages: sorted });
  } catch (error) {
    console.error('Error in getMessageThread:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});