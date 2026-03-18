import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all attendance records for year 2025-26
    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({ academic_year: '2025-26' });
    
    // Fetch all valid students for year 2025-26
    const validStudents = await base44.asServiceRole.entities.Student.filter({ academic_year: '2025-26', is_deleted: false });
    const validStudentIds = new Set(validStudents.map(s => s.student_id));

    let orphanCount = 0;
    const orphanIds = [];
    const duplicateIds = [];
    const seenKeys = new Set();

    // Find orphans (student_id not in Student table) and duplicates
    for (const record of allAttendance) {
      if (!validStudentIds.has(record.student_id)) {
        orphanIds.push(record.id);
        orphanCount++;
      }

      // Check for duplicates: same date + student_id + class_name + section + academic_year
      const key = `${record.date}|${record.student_id}|${record.class_name}|${record.section}`;
      if (seenKeys.has(key)) {
        duplicateIds.push(record.id);
      }
      seenKeys.add(key);
    }

    // Note: Attendance entity has RLS delete=false, so hard delete not possible
    // Records marked as orphan/duplicate cannot be removed
    // This is expected behavior - attendance is read-only after submission
    let deleted = 0;

    return Response.json({
      success: true,
      orphanFound: orphanCount,
      orphanIds,
      duplicatesFound: duplicateIds.length,
      duplicateIds,
      totalDeleted: deleted,
      validStudentCount: validStudents.length,
      totalAttendanceRecords: allAttendance.length,
      remainingRecords: allAttendance.length - deleted
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});