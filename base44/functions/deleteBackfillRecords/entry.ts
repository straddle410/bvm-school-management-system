import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const allAttendance = await base44.asServiceRole.entities.Attendance.list();
    const backfillRecords = allAttendance.filter(a => a.marked_by === 'DATA_CORRECTION');

    let deleted = 0;
    for (const record of backfillRecords) {
      try {
        await base44.asServiceRole.entities.Attendance.delete(record.id);
        deleted++;
      } catch (e) {
        console.warn(`Failed to delete ${record.id}:`, e.message);
      }
    }

    return Response.json({
      message: `Deleted ${deleted} backfill records (marked_by: DATA_CORRECTION)`,
      totalDeleted: deleted
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});