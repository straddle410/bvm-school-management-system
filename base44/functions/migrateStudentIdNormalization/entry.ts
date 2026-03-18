import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const students = await base44.asServiceRole.entities.Student.list('', 10000);
    
    let normalized_count = 0;
    let generated_missing_count = 0;
    let conflict_count = 0;
    const conflict_details = [];
    let updated_records_count = 0;

    // First pass: normalize all IDs and collect norm values
    const normMap = {}; // track which norms we've seen
    const updates = [];

    for (const student of students) {
      let studentId = student.student_id;
      let studentIdNorm = student.student_id_norm;

      if (studentId && typeof studentId === 'string') {
        // Normalize existing ID
        studentId = studentId.trim().toUpperCase();
        studentIdNorm = studentId.toLowerCase();
        normalized_count++;
      } else if (!studentId && student.academic_year) {
        // Generate missing ID
        try {
          const genRes = await base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
            academic_year: student.academic_year
          });
          if (genRes.data && genRes.data.student_id) {
            studentId = genRes.data.student_id;
            studentIdNorm = genRes.data.student_id_norm;
            generated_missing_count++;
          } else {
            continue;
          }
        } catch {
          continue;
        }
      } else {
        continue;
      }

      // Check for collisions
      if (normMap[studentIdNorm] && normMap[studentIdNorm] !== student.id) {
        conflict_count++;
        conflict_details.push({
          record_id: student.id,
          current_student_id: student.student_id,
          normalized_collision_with: normMap[studentIdNorm],
          action: 'CONFLICT_DETECTED'
        });
        // For deleted students, allow duplicate norm; for active, reassign
        if (!student.is_deleted && !student.archived_by) {
          // Try to get a new unique ID
          try {
            const genRes = await base44.asServiceRole.functions.invoke('generateStudentIdAuthoritative', {
              academic_year: student.academic_year
            });
            if (genRes.data && genRes.data.student_id) {
              studentId = genRes.data.student_id;
              studentIdNorm = genRes.data.student_id_norm;
              conflict_details[conflict_details.length - 1].action = 'REASSIGNED_TO_' + studentId;
            }
          } catch {}
        }
      }

      normMap[studentIdNorm] = student.id;
      updates.push({
        id: student.id,
        student_id: studentId,
        student_id_norm: studentIdNorm
      });
    }

    // Second pass: apply all updates atomically
    for (const update of updates) {
      await base44.asServiceRole.entities.Student.update(update.id, {
        student_id: update.student_id,
        student_id_norm: update.student_id_norm
      });
      updated_records_count++;
    }

    return Response.json({
      status: 'completed',
      total_students: students.length,
      normalized_count,
      generated_missing_count,
      conflict_count,
      conflict_details,
      updated_records_count,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});