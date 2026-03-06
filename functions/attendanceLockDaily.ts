import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Helper: Get current time in IST using Intl API (reliable, no timezone conversion issues)
function getISTTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const dateObj = {};
  parts.forEach(p => { dateObj[p.type] = p.value; });
  
  return {
    hours: parseInt(dateObj.hour),
    minutes: parseInt(dateObj.minute),
    year: parseInt(dateObj.year),
    month: parseInt(dateObj.month),
    day: parseInt(dateObj.day),
    dateString: `${dateObj.year}-${dateObj.month}-${dateObj.day}`
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can trigger this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Get current time in IST (reliable method using Intl API)
    const istTime = getISTTime();
    const istTimeInMinutes = istTime.hours * 60 + istTime.minutes;
    const lockTimeInMinutes = 15 * 60; // 3:00 PM = 15:00

    // Only lock if current time >= 3:00 PM IST (15:00)
    if (istTimeInMinutes < lockTimeInMinutes) {
      return Response.json({
        message: `Current IST time: ${istTime.hours.toString().padStart(2, '0')}:${istTime.minutes.toString().padStart(2, '0')}. Lock not triggered (before 3:00 PM IST).`,
        locked: 0
      });
    }

    // Get today's date in IST
    const todayIST = istTime.dateString;

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