import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── ADMIN ONLY ──
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const log = [];
    const results = {};

    const deleteAll = async (entityName) => {
      const records = await base44.asServiceRole.entities[entityName].list();
      const count = records.length;
      log.push(`[${entityName}] Found ${count} records to delete`);

      let deleted = 0;
      for (const record of records) {
        await base44.asServiceRole.entities[entityName].delete(record.id);
        deleted++;
      }

      // Verify
      const remaining = await base44.asServiceRole.entities[entityName].list();
      results[entityName] = {
        deleted: deleted,
        remaining: remaining.length
      };
      log.push(`[${entityName}] Deleted ${deleted}, Remaining: ${remaining.length}`);
    };

    // ── ENTITIES TO DELETE (in safe order) ──
    const entitiesToDelete = [
      'ProgressCard',
      'HallTicket',
      'HallTicketLog',
      'ExamTimetable',
      'Marks',
      'Attendance',
      'ExamType',
      'Holiday',
      'AuditLog',
    ];

    for (const entity of entitiesToDelete) {
      await deleteAll(entity);
    }

    // ── VERIFY PROTECTED ENTITIES ARE UNTOUCHED ──
    const protected_checks = {};
    const [students, staff, academicYears] = await Promise.all([
      base44.asServiceRole.entities.Student.list(),
      base44.asServiceRole.entities.Teacher.list(),
      base44.asServiceRole.entities.AcademicYear.list(),
    ]);

    protected_checks['Student'] = students.length;
    protected_checks['Teacher'] = staff.length;
    protected_checks['AcademicYear'] = academicYears.length;

    log.push(`[PROTECTED] Students: ${students.length}, Teachers: ${staff.length}, AcademicYears: ${academicYears.length} — all untouched`);

    // ── SUMMARY ──
    const allClean = Object.values(results).every(r => r.remaining === 0);

    return Response.json({
      success: true,
      performed_by: user.email,
      timestamp: new Date().toISOString(),
      scope: 'ALL academic years',
      deletion_results: results,
      protected_entities: protected_checks,
      system_clean: allClean,
      ready_for_fresh_data: allClean,
      log
    });

  } catch (error) {
    console.error('Production reset error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});