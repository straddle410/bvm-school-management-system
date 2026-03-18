import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { thread_id, parent_message_id, _studentId, _staffUsername } = payload;

    if (!thread_id && !parent_message_id) {
      return Response.json({ error: 'thread_id or parent_message_id required' }, { status: 400 });
    }

    // ── AUTH: Support Base44 JWT, student custom sessions, and staff custom sessions ──
    let currentUserId = null;

    if (_studentId) {
      // Student custom session: verify student exists
      const students = await base44.asServiceRole.entities.Student.filter({ student_id: _studentId });
      if (students.length > 0 && !students[0].is_deleted && students[0].is_active !== false) {
        currentUserId = _studentId;
      }
    } else if (_staffUsername) {
      // Staff custom session — username is the canonical messaging ID
      currentUserId = _staffUsername;
    } else {
      try {
        const user = await base44.auth.me();
        if (user) currentUserId = user.email;
      } catch {}
    }

    if (!currentUserId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all messages in thread via service role
    const allMessages = await base44.asServiceRole.entities.Message.filter({
      thread_id: thread_id || parent_message_id,
    });

    // Filter: only messages where user is sender OR recipient
    const accessibleMessages = allMessages.filter(m =>
      m.sender_id === currentUserId || m.recipient_id === currentUserId
    );

    if (accessibleMessages.length === 0) {
      return Response.json({ error: 'Forbidden: No access to this thread' }, { status: 403 });
    }

    const sorted = accessibleMessages.sort((a, b) =>
      new Date(a.created_date) - new Date(b.created_date)
    );

    // Auto-mark messages as read when recipient opens the thread
    const now = new Date().toISOString();
    const toMarkRead = sorted.filter(m =>
      m.recipient_id === currentUserId && !m.read_at
    );
    await Promise.all(
      toMarkRead.map(m =>
        base44.asServiceRole.entities.Message.update(m.id, { read_at: now, is_read: true })
      )
    );
    // Update local copies so response reflects read state
    toMarkRead.forEach(m => { m.read_at = now; m.is_read = true; });

    return Response.json({ messages: sorted });
  } catch (error) {
    console.error('Error in getMessageThread:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});