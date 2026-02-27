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

    // Status check (no entityName)
    if (!entityName) {
      const status = {};
      for (const e of ALLOWED_ENTITIES) {
        const records = await base44.asServiceRole.entities[e].list(undefined, 200);
        status[e] = records?.length ?? 0;
        await sleep(150);
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

    // Count before deletion
    let totalFound = 0;
    let totalDeleted = 0;
    let page = 0;
    const pageSize = 50;

    // Delete in pages: fetch a page, delete all, repeat until none left
    let attempts = 0;
    const maxAttempts = 200; // safety cap

    while (attempts < maxAttempts) {
      await sleep(600); // conservative delay between pages to avoid rate limits

      const batch = await base44.asServiceRole.entities[entityName].list(undefined, pageSize);
      if (!batch || batch.length === 0) break;

      totalFound += batch.length;

      for (const record of batch) {
        await base44.asServiceRole.entities[entityName].delete(record.id);
        totalDeleted++;
        await sleep(200); // 200ms between each delete
      }

      attempts++;

      // If we got fewer than pageSize, we've likely cleared everything
      if (batch.length < pageSize) break;
    }

    // Final verification
    await sleep(500);
    const remaining = await base44.asServiceRole.entities[entityName].list(undefined, 10);
    const remainingCount = remaining?.length ?? 0;

    return Response.json({
      entityName,
      found: totalFound,
      deleted: totalDeleted,
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