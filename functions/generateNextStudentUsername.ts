import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Generate next sequential student username.
 * Format: BVM001, BVM002, etc.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allStudents = await base44.asServiceRole.entities.Student.list() || [];
    
    // Find all BVM* usernames and extract numbers
    let maxNum = 0;
    for (const student of allStudents) {
      const username = (student.username || '').trim().toLowerCase();
      if (username.startsWith('bvm')) {
        const numPart = username.substring(3);
        const num = parseInt(numPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }

    const nextNum = maxNum + 1;
    const nextUsername = `BVM${String(nextNum).padStart(3, '0')}`;

    return Response.json({
      success: true,
      next_username: nextUsername,
      next_number: nextNum,
      last_number: maxNum,
    });
  } catch (error) {
    console.error('[generateNextStudentUsername] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});