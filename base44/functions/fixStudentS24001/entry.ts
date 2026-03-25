import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get both records for S24001
  const students = await base44.asServiceRole.entities.Student.filter({ student_id: 'S24001' });
  
  const old = students.find(s => s.academic_year === '2024-25');
  const newRec = students.find(s => s.academic_year === '2025-26');

  if (!old || !newRec) {
    return Response.json({ error: 'Records not found', students: students.map(s => ({ id: s.id, ay: s.academic_year })) });
  }

  // Copy password_hash from old record to new record and set student_id_norm
  const updated = await base44.asServiceRole.entities.Student.update(newRec.id, {
    student_id_norm: 's24001',
    password_hash: old.password_hash,
    must_change_password: false,
  });

  return Response.json({ 
    success: true, 
    old_id: old.id, 
    new_id: newRec.id,
    new_class: newRec.class_name,
    new_ay: newRec.academic_year,
    updated 
  });
});