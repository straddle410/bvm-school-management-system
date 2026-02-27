import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Allowed entities for reset (whitelist for safety)
const ALLOWED_ENTITIES = [
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { entityName, dryRun } = await req.json();

    if (!entityName) {
      // Return status of all entities (read-only)
      const status = {};
      for (const e of ALLOWED_ENTITIES) {
        const records = await base44.asServiceRole.entities[e].list(undefined, 200);
        status[e] = records?.length ?? 0;
        await sleep(100);
      }
      const [students, teachers, academicYears] = await Promise.all([
        base44.asServiceRole.entities.Student.list(undefined, 5),
        base44.asServiceRole.entities.Teacher.list(undefined, 5),
        base44.asServiceRole.entities.AcademicYear.list(undefined, 5),
      ]);
      return Response.json({
        mode: 'status',
        transactional_entities: status,
        protected_entities: {
          Student: students?.length ?? 'ok',
          Teacher: teachers?.length ?? 'ok',
          AcademicYear: academicYears?.length ?? 'ok',
        }
      });
    }

    if (!ALLOWED_ENTITIES.includes(entityName)) {
      return Response.json({ error: `Entity "${entityName}" is not in the allowed reset list.` }, { status: 400 });
    }

    // Fetch all IDs in batches
    let allIds = [];
    let offset = 0;
    const batchSize = 200;

    while (true) {
      const batch = await base44.asServiceRole.entities[entityName].list(undefined, batchSize, offset);
      if (!batch || batch.length === 0) break;
      allIds = allIds.concat(batch.map(r => r.id));
      if (batch.length < batchSize) break;
      offset += batchSize;
      await sleep(150);
    }

    const found = allIds.length;

    if (dryRun) {
      return Response.json({ entityName, found, deleted: 0, dry_run: true, message: `Would delete ${found} records` });
    }

    let deleted = 0;
    const errors = [];

    for (const id of allIds) {
      try {
        await base44.asServiceRole.entities[entityName].delete(id);
        deleted++;
      } catch (e) {
        errors.push({ id, error: e.message });
      }
      // Small delay every 10 deletions
      if (deleted % 10 === 0) await sleep(100);
    }

    // Spot-check remaining
    const remaining = await base44.asServiceRole.entities[entityName].list(undefined, 10);
    const remainingCount = remaining?.length ?? 0;

    return Response.json({
      entityName,
      found,
      deleted,
      remaining_spot_check: remainingCount,
      errors: errors.length > 0 ? errors : undefined,
      clean: remainingCount === 0,
      performed_by: user.email,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('productionResetEntity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});