import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Check if user is admin
    if (user?.role !== 'admin') {
      // Also check staff session
      const session = localStorage?.getItem?.('staff_session');
      if (session) {
        const staff = JSON.parse(session);
        if (staff.role !== 'Admin' && staff.role !== 'admin') {
          return Response.json({ error: 'Unauthorized' }, { status: 403 });
        }
      } else {
        return Response.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    // Delete all attendance records marked as holidays
    const holidayAttendance = await base44.asServiceRole.entities.Attendance.filter({ is_holiday: true, status: 'Holiday' });
    
    let deletedCount = 0;
    for (const record of holidayAttendance) {
      try {
        await base44.asServiceRole.entities.Attendance.delete(record.id);
        deletedCount++;
      } catch (err) {
        console.log('Failed to delete record:', record.id);
      }
    }

    return Response.json({ 
      success: true, 
      deletedCount: deletedCount,
      message: `Cleared ${deletedCount} stale holiday attendance records`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});