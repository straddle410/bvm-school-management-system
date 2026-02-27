import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    let user;
    try {
      user = await base44.auth.me();
    } catch {
      user = null;
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all students and find the highest number
    const students = await base44.asServiceRole.entities.Student.list();
    
    let maxNumber = 26000; // Starting point
    
    students.forEach(student => {
      if (student.student_id && student.student_id.startsWith('S')) {
        const numPart = parseInt(student.student_id.substring(1));
        if (!isNaN(numPart) && numPart > maxNumber) {
          maxNumber = numPart;
        }
      }
    });

    const nextId = `S${maxNumber + 1}`;
    
    return Response.json({ 
      next_student_id: nextId,
      message: `Next student ID will be ${nextId}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});