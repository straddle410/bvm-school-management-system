import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { folder = 'inbox', limit = 50, cursor = null, _studentId, _staffUsername } = payload;

    if (!['inbox', 'sent'].includes(folder)) {
      return Response.json({ error: 'Invalid folder' }, { status: 400 });
    }

    // ── AUTH: Support Base44 JWT (admin via base44 dashboard), student sessions, and staff sessions ──
    let currentUserId = null;

    if (_studentId) {
      // Student custom session
      const students = await base44.asServiceRole.entities.Student.filter({ student_id: _studentId });
      if (students.length > 0 && !students[0].is_deleted && students[0].is_active !== false) {
        currentUserId = _studentId;
      }
    } else if (_staffUsername) {
      // Staff custom session — username is the canonical messaging ID
      currentUserId = _staffUsername;
    } else {
      // Base44 JWT (admin via platform or browser-authenticated)
      try {
        const user = await base44.auth.me();
        if (user) currentUserId = user.email;
      } catch {}
    }

    if (!currentUserId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let query = {};
    if (folder === 'inbox') {
      query = { recipient_id: currentUserId, recipient_type: 'individual' };
    } else {
      query = { sender_id: currentUserId };
    }

    const allMessages = await base44.asServiceRole.entities.Message.filter(query);

    // Auto-mark inbox messages as delivered (sets delivered_at if not already set)
    if (folder === 'inbox') {
      const undelivered = allMessages.filter(m => !m.delivered_at);
      if (undelivered.length > 0) {
        const now = new Date().toISOString();
        try {
          // Batch update all undelivered messages at once
          await base44.asServiceRole.entities.Message.bulkUpdate(
            undelivered.map(m => ({ id: m.id, delivered_at: now }))
          );
          // Update local copies so response includes delivered_at
          undelivered.forEach(m => { m.delivered_at = now; });
        } catch (err) {
          console.warn('Failed to mark messages as delivered:', err.message);
          // Continue anyway — just skip the delivery marking
        }
      }
    }

    // Sort descending, apply cursor/limit
    const sorted = allMessages.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

    let start = 0;
    if (cursor) {
      const idx = sorted.findIndex(m => m.id === cursor);
      if (idx > -1) start = idx + 1;
    }

    const messages = sorted.slice(start, start + limit);
    const nextCursor = messages.length === limit && start + limit < sorted.length
      ? messages[messages.length - 1].id
      : null;

    return Response.json({ messages, nextCursor });
  } catch (error) {
    console.error('Error in listMyMessages:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});