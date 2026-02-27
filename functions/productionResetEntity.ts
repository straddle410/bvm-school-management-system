import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

    const body = await req.json().catch(() => ({}));
    const { entityName } = body;

    // ── STATUS CHECK (no entityName) ──
    if (!entityName) {
      const status = {};
      for (const e of ALLOWED_ENTITIES) {
        try {
          const records = await base44.asServiceRole.entities[e].list(undefined, 200);
          status[e] = records?.length ?? 0;
        } catch {
          status[e] = -1;
        }
        await sleep(300);
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
          Student: students?.length ?? 0,
          Teacher: teachers?.length ?? 0,
          AcademicYear: academicYears?.length ?? 0,
        }
      });
    }

    if (!ALLOWED_ENTITIES.includes(entityName)) {
      return Response.json({ error: `Entity "${entityName}" is not in the allowed reset list.` }, { status: 400 });
    }

    // ── DELETE ONE BATCH OF 20 RECORDS ──
    // Each call deletes up to 20 records safely within timeout + rate limits.
    // The UI calls this repeatedly until remaining = 0.
    const BATCH_SIZE = 20;

    const batch = await base44.asServiceRole.entities[entityName].list(undefined, BATCH_SIZE);

    if (!batch || batch.length === 0) {
      return Response.json({
        entityName,
        found: 0,
        deleted: 0,
        remaining_spot_check: 0,
        clean: true,
        performed_by: user.email,
        timestamp: new Date().toISOString()
      });
    }

    let deleted = 0;
    for (const record of batch) {
      try {
        await base44.asServiceRole.entities[entityName].delete(record.id);
        deleted++;
        await sleep(300); // 300ms gap between each delete
      } catch (e) {
        console.error(`Failed to delete ${entityName} ${record.id}:`, e.message);
        await sleep(1000); // longer wait on error
      }
    }

    // Check remaining
    await sleep(500);
    const remaining = await base44.asServiceRole.entities[entityName].list(undefined, 10);
    const remainingCount = remaining?.length ?? 0;

    return Response.json({
      entityName,
      found: batch.length,
      deleted,
      remaining_spot_check: remainingCount,
      clean: remainingCount === 0,
      performed_by: user.email,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('productionResetEntity error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});