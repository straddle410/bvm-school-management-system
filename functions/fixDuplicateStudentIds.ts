import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, student_id: targetStudentId, record_id } = await req.json();

    if (!action || !targetStudentId) {
      return Response.json({ error: 'action and student_id required' }, { status: 400 });
    }

    const allStudents = await base44.asServiceRole.entities.Student.list();
    
    // Find all records with the duplicate student_id
    const duplicateRecords = allStudents.filter(s => String(s.student_id).trim() === String(targetStudentId).trim());

    if (duplicateRecords.length < 2) {
      return Response.json({ error: 'No duplicates found for this student_id' }, { status: 400 });
    }

    // Sort by created_date: first record is "primary", rest are "secondary"
    duplicateRecords.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    const primaryRecord = duplicateRecords[0];
    const secondaryRecords = duplicateRecords.slice(1);

    if (action === 'list') {
      return Response.json({
        primary_record: {
          id: primaryRecord.id,
          name: primaryRecord.name,
          class: primaryRecord.class_name,
          year: primaryRecord.academic_year,
          created: primaryRecord.created_date
        },
        secondary_records: secondaryRecords.map(r => ({
          id: r.id,
          name: r.name,
          class: r.class_name,
          year: r.academic_year,
          created: r.created_date
        }))
      });
    }

    if (action === 'delete_secondary') {
      // Delete all secondary records (soft delete via is_deleted flag)
      const results = [];
      for (const rec of secondaryRecords) {
        await base44.asServiceRole.entities.Student.update(rec.id, { is_deleted: true });
        results.push({ id: rec.id, name: rec.name, status: 'deleted' });
      }
      return Response.json({ action, student_id: targetStudentId, deleted: results });
    }

    if (action === 'reassign_secondary') {
      if (!record_id) {
        return Response.json({ error: 'record_id required for reassign action' }, { status: 400 });
      }

      // Find the next available student_id for the target academic year
      const targetRecord = allStudents.find(s => s.id === record_id);
      if (!targetRecord) {
        return Response.json({ error: 'Record not found' }, { status: 404 });
      }

      const year = targetRecord.academic_year;
      const yearStudents = allStudents.filter(s => s.academic_year === year);
      
      // Extract numeric parts and find max
      let maxNum = 0;
      yearStudents.forEach(s => {
        const match = String(s.student_id).match(/\d+$/);
        if (match) {
          const num = parseInt(match[0], 10);
          maxNum = Math.max(maxNum, num);
        }
      });

      const newStudentId = `S${year.split('-')[0]}${String(maxNum + 1).padStart(3, '0')}`;

      await base44.asServiceRole.entities.Student.update(record_id, {
        student_id: newStudentId,
        username: newStudentId
      });

      return Response.json({
        action,
        record_id,
        name: targetRecord.name,
        old_student_id: targetRecord.student_id,
        new_student_id: newStudentId
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});