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

    const { quizId, reason } = await req.json();
    if (!quizId) {
      return Response.json({ error: 'quizId required' }, { status: 400 });
    }

    const quiz = await base44.entities.Quiz.get(quizId);
    if (!quiz) {
      return Response.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.status !== 'PendingApproval') {
      return Response.json({ error: `Cannot reject from ${quiz.status} status` }, { status: 400 });
    }

    await base44.entities.Quiz.update(quizId, { 
      status: 'Draft',
      rejection_reason: reason || null,
      rejected_at: new Date().toISOString()
    });
    
    return Response.json({ success: true, status: 'Draft', reason });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});