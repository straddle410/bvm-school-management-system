import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// One-time backfill: for all promoted students missing password_hash or student_id_norm,
// copy credentials from their previous year's record.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch ALL students across all years
    const allStudents = await base44.asServiceRole.entities.Student.list('-academic_year', 100000);

    // Group by student_id
    const byStudentId = {};
    for (const s of allStudents) {
      if (!s.student_id) continue;
      if (!byStudentId[s.student_id]) byStudentId[s.student_id] = [];
      byStudentId[s.student_id].push(s);
    }

    let fixed = 0;
    let skipped = 0;
    const details = [];

    for (const [studentId, records] of Object.entries(byStudentId)) {
      if (records.length < 2) { skipped++; continue; } // Only promoted students have multiple records

      // Sort by academic year descending — newest first
      records.sort((a, b) => (b.academic_year || '').localeCompare(a.academic_year || ''));

      const newest = records[0];

      // Only fix if newest record is missing password_hash or student_id_norm
      if (newest.password_hash && newest.student_id_norm) { skipped++; continue; }

      // Find older record that has a password_hash
      const sourceRecord = records.find(r => r.academic_year !== newest.academic_year && r.password_hash);
      if (!sourceRecord) { 
        details.push(`No source with password_hash for ${studentId}`);
        skipped++; 
        continue; 
      }

      const updateData = {};
      if (!newest.password_hash) updateData.password_hash = sourceRecord.password_hash;
      if (!newest.student_id_norm) updateData.student_id_norm = studentId.trim().toLowerCase();
      if (newest.must_change_password === undefined || newest.must_change_password === null) {
        updateData.must_change_password = sourceRecord.must_change_password || false;
      }

      await base44.asServiceRole.entities.Student.update(newest.id, updateData);
      fixed++;
      details.push(`Fixed ${studentId} (${newest.name}): ${newest.academic_year} class ${newest.class_name}`);
    }

    return Response.json({
      success: true,
      total_student_ids: Object.keys(byStudentId).length,
      fixed,
      skipped,
      details,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});