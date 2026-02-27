import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const studentId = body.student_id || null; // optional: filter to one student
    const className = body.class_name || '9';
    const academicYear = body.academic_year || '2024-25';

    // Fetch all attendance for the class/year (or single student)
    const filter = studentId
      ? { student_id: studentId, academic_year: academicYear }
      : { class_name: className, academic_year: academicYear };

    const allAttendance = await base44.asServiceRole.entities.Attendance.filter(filter);
    console.log(`[DEDUP] Processing ${allAttendance.length} attendance records for ${studentId || `class ${className}`}, ${academicYear}`);

    // Group by (student_id, date) to find duplicates
    const groupedByStudentDate = {};
    allAttendance.forEach(record => {
      const key = `${record.student_id}__${record.date}`;
      if (!groupedByStudentDate[key]) groupedByStudentDate[key] = [];
      groupedByStudentDate[key].push(record);
    });

    // Find groups with multiple records
    const duplicates = Object.entries(groupedByStudentDate)
      .filter(([, records]) => records.length > 1)
      .map(([key, records]) => ({ key, records }));

    console.log(`[DEDUP] Found ${duplicates.length} duplicate groups`);

    // For each duplicate group, keep the best record and delete others
    let deletedCount = 0;
    const consolidationLog = [];

    // Priority: full_day > half_day > absent > holiday
    const priority = (r) => {
      if (r.attendance_type === 'full_day') return 4;
      if (r.attendance_type === 'half_day') return 3;
      if (r.attendance_type === 'absent') return 2;
      if (r.attendance_type === 'holiday') return 1;
      return 0;
    };

    for (const { key, records } of duplicates) {
      // Sort: highest priority first, then prefer 'Approved' status, then newest created
      records.sort((a, b) => {
        const pDiff = priority(b) - priority(a);
        if (pDiff !== 0) return pDiff;
        // same type: prefer Approved status
        const aApproved = a.status === 'Approved' ? 1 : 0;
        const bApproved = b.status === 'Approved' ? 1 : 0;
        if (bApproved !== aApproved) return bApproved - aApproved;
        // then newest
        return new Date(b.created_date) - new Date(a.created_date);
      });

      const keeper = records[0];
      const toDelete = records.slice(1);

      consolidationLog.push({
        key,
        kept: `${keeper.attendance_type} (${keeper.status})`,
        deleted_count: toDelete.length,
        deleted_types: toDelete.map(r => `${r.attendance_type}(${r.status})`)
      });

      for (const record of toDelete) {
        await base44.asServiceRole.entities.Attendance.delete(record.id);
        deletedCount++;
      }
    }

    console.log(`[DEDUP] Done. Deleted ${deletedCount} duplicate records across ${duplicates.length} groups`);

    return Response.json({
      message: `Deduplication complete`,
      scope: studentId ? `Student ${studentId}` : `Class ${className}, ${academicYear}`,
      totalRecordsProcessed: allAttendance.length,
      duplicateGroupsFound: duplicates.length,
      recordsDeleted: deletedCount,
      cleanRecordsRemaining: allAttendance.length - deletedCount,
      consolidationLog: consolidationLog.slice(0, 20)
    });
  } catch (error) {
    console.error('[DEDUP-ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});