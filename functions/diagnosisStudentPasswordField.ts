import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Find student by student_id_norm = 's25007'
    const students = await base44.asServiceRole.entities.Student.filter({
      student_id_norm: 's25007'
    });

    if (students.length === 0) {
      return Response.json({ error: 'Student S25007 not found' }, { status: 404 });
    }

    const student = students[0];

    return Response.json({
      // Identity fields
      id: student.id,
      student_id: student.student_id,
      student_id_norm: student.student_id_norm,
      username: student.username,
      
      // Password fields - THE KEY DATA
      password: student.password,  // Raw plaintext (if exists)
      password_hash: student.password_hash,  // Bcrypt hash (if exists)
      
      // Status fields
      must_change_password: student.must_change_password,
      is_active: student.is_active,
      is_deleted: student.is_deleted,
      
      // Timestamps
      created_date: student.created_date,
      updated_date: student.updated_date,
      
      // Metadata for verification
      name: student.name,
      class_name: student.class_name,
      section: student.section
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});