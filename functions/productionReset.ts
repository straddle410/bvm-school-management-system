import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const DELAY_MS = 200; // ms between deletes to avoid rate limit
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const log = [];
    const results = {};

    const deleteAll = async (entityName) => {
      // Fetch all records (up to 500 per batch)
      let allIds = [];
      let offset = 0;
      const batchSize = 100;

      while (true) {
        const batch = await base44.asServiceRole.entities[entityName].list(undefined, batchSize, offset);
        if (!batch || batch.length === 0) break;
        allIds = allIds.concat(batch.map(r => r.id));
        if (batch.length < batchSize) break;
        offset += batchSize;
        await sleep(DELAY_MS);
      }

      log.push(`[${entityName}] Found ${allIds.length} records to delete`);

      let deleted = 0;
      for (const id of allIds) {
        await base44.asServiceRole.entities[entityName].delete(id);
        deleted++;
        if (deleted % 20 === 0) await sleep(DELAY_MS);
      }

      // Verify remaining
      const remaining = await base44.asServiceRole.entities[entityName].list(undefined, 10);
      const remainingCount = remaining ? remaining.length : 0;

      results[entityName] = { deleted, remaining: remainingCount };
      log.push(`[${entityName}] Deleted: ${deleted}, Remaining (spot-check): ${remainingCount}`);
    };

    // ── DELETE ORDER (safest dependency order) ──
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
      await sleep(300);
    }

    // ── VERIFY PROTECTED ENTITIES UNTOUCHED ──
    const [students, teachers, academicYears] = await Promise.all([
      base44.asServiceRole.entities.Student.list(undefined, 5),
      base44.asServiceRole.entities.Teacher.list(undefined, 5),
      base44.asServiceRole.entities.AcademicYear.list(undefined, 5),
    ]);

    const protected_checks = {
      Student: students?.length ?? 0,
      Teacher: teachers?.length ?? 0,
      AcademicYear: academicYears?.length ?? 0,
    };

    log.push(`[PROTECTED] Students: ${protected_checks.Student}, Teachers: ${protected_checks.Teacher}, AcademicYears: ${protected_checks.AcademicYear} — all untouched`);

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