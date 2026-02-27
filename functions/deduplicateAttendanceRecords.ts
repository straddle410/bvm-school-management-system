import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const studentId = body.student_id || null;
    const className = body.class_name || '9';
    const academicYear = body.academic_year || '2024-25';

    // Priority: full_day > half_day > absent > holiday
    const priority = (r) => {
      if (r.attendance_type === 'full_day') return 4;
      if (r.attendance_type === 'half_day') return 3;
      if (r.attendance_type === 'absent') return 2;
      if (r.attendance_type === 'holiday') return 1;
      return 0;
    };

    const deduplicateForStudent = async (sid) => {
      const records = await base44.asServiceRole.entities.Attendance.filter({
        student_id: sid,
        academic_year: academicYear
      });

      // Group by date
      const byDate = {};
      records.forEach(r => {
        const k = r.date;
        if (!byDate[k]) byDate[k] = [];
        byDate[k].push(r);
      });

      const toDelete = [];
      let dupGroups = 0;

      Object.values(byDate).forEach(group => {
        if (group.length <= 1) return;
        dupGroups++;
        group.sort((a, b) => {
          const pDiff = priority(b) - priority(a);
          if (pDiff !== 0) return pDiff;
          const aApproved = a.status === 'Approved' ? 1 : 0;
          const bApproved = b.status === 'Approved' ? 1 : 0;
          if (bApproved !== aApproved) return bApproved - aApproved;
          return new Date(b.created_date) - new Date(a.created_date);
        });
        group.slice(1).forEach(r => toDelete.push(r.id));
      });

      // Delete one at a time with delay to avoid rate limits
      let deleted = 0;
      for (const id of toDelete) {
        await base44.asServiceRole.entities.Attendance.delete(id);
        deleted++;
        await new Promise(r => setTimeout(r, 400));
      }

      return { total: records.length, dupGroups, deleted };
    };

    let totalDeleted = 0;
    let totalDupGroups = 0;
    let totalRecords = 0;
    const studentResults = [];

    if (studentId) {
      const result = await deduplicateForStudent(studentId);
      totalDeleted = result.deleted;
      totalDupGroups = result.dupGroups;
      totalRecords = result.total;
      studentResults.push({ student_id: studentId, ...result });
    } else {
      // Fetch all students for the class
      const students = await base44.asServiceRole.entities.Student.filter({
        class_name: className,
        academic_year: academicYear
      });

      console.log(`[DEDUP] Processing ${students.length} students for class ${className}, ${academicYear}`);

      for (const student of students) {
        const sid = student.student_id || student.id;
        console.log(`[DEDUP] Deduplicating student ${student.name} (${sid})`);
        const result = await deduplicateForStudent(sid);
        totalDeleted += result.deleted;
        totalDupGroups += result.dupGroups;
        totalRecords += result.total;
        studentResults.push({ student_id: sid, name: student.name, ...result });
        // Pause between students to avoid rate limits
        await new Promise(r => setTimeout(r, 800));
      }
    }

    console.log(`[DEDUP] Complete. Deleted ${totalDeleted} duplicates across ${totalDupGroups} groups`);

    return Response.json({
      message: 'Deduplication complete',
      scope: studentId ? `Student ${studentId}` : `Class ${className}, ${academicYear}`,
      totalRecordsProcessed: totalRecords,
      duplicateGroupsFound: totalDupGroups,
      recordsDeleted: totalDeleted,
      cleanRecordsRemaining: totalRecords - totalDeleted,
      studentResults
    });
  } catch (error) {
    console.error('[DEDUP-ERROR]', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});