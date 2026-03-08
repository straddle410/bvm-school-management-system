import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Role validation: only admin/principal can unlock
    const userRole = (user.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(userRole)) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { date, class_name, section, academic_year } = await req.json();

    if (!date || !class_name || !section || !academic_year) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch all attendance records matching the criteria
    const records = await base44.asServiceRole.entities.Attendance.filter({
      date,
      class_name,
      section,
      academic_year
    });

    // Unlock all matching records
    const unlockPromises = records.map(record =>
      base44.asServiceRole.entities.Attendance.update(record.id, {
        is_locked: false,
        unlocked_by: user.email,
        unlocked_at: new Date().toISOString()
      })
    );

    const updatedRecords = await Promise.all(unlockPromises);

    return Response.json({
      success: true,
      recordsUnlocked: updatedRecords.length,
      message: `Unlocked ${updatedRecords.length} attendance record(s) for ${class_name}-${section} on ${date}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});