import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { quizId, staffInfo } = await req.json();
    if (!staffInfo || !staffInfo.staff_id) {
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }
    const userRole = (staffInfo.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Forbidden: Admin/Principal only' }, { status: 403 });
    }
    if (!quizId) {
      return Response.json({ error: 'quizId required' }, { status: 400 });
    }

    const quiz = await base44.entities.Quiz.get(quizId);
    if (!quiz) {
      return Response.json({ error: 'Quiz not found' }, { status: 404 });
    }

    if (quiz.status !== 'PendingApproval') {
      return Response.json({ error: `Cannot approve from ${quiz.status} status` }, { status: 400 });
    }

    await base44.entities.Quiz.update(quizId, { status: 'Published' });
    
    return Response.json({ success: true, status: 'Published' });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});