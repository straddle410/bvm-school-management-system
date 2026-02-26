import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can trigger this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Convert current time to IST (UTC+5:30)
    const now = new Date();
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const istHours = istTime.getHours();
    const istMinutes = istTime.getMinutes();
    const istTimeInMinutes = istHours * 60 + istMinutes;
    const lockTimeInMinutes = 15 * 60; // 3:00 PM = 15:00

    // Only lock if current time >= 3:00 PM IST (15:00)
    if (istTimeInMinutes < lockTimeInMinutes) {
      return Response.json({
        message: `Current IST time: ${istHours.toString().padStart(2, '0')}:${istMinutes.toString().padStart(2, '0')}. Lock not triggered (before 3:00 PM IST).`,
        locked: 0
      });
    }

    // Get today's date in IST
    const todayIST = istTime.toISOString().split('T')[0];

    // Fetch all Taken status attendance records for today
    const allAttendance = await base44.asServiceRole.entities.Attendance.list();
    const todayAttendance = allAttendance.filter(a => 
      a.date === todayIST && 
      a.status === 'Taken' && 
      !a.is_locked
    );

    if (todayAttendance.length === 0) {
      return Response.json({
        message: `No attendance records to lock for ${todayIST}`,
        locked: 0
      });
    }

    // Lock all today's records
    const lockPromises = todayAttendance.map(record =>
      base44.asServiceRole.entities.Attendance.update(record.id, {
        is_locked: true,
        locked_at: new Date().toISOString(),
        status: 'Submitted'
      })
    );

    await Promise.all(lockPromises);

    return Response.json({
      message: `Locked ${todayAttendance.length} attendance records at 3:00 PM IST on ${todayIST}`,
      locked: todayAttendance.length,
      lockedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Attendance lock error:', error);
    return Response.json(
      { error: error.message || 'Failed to lock attendance' },
      { status: 500 }
    );
  }
});