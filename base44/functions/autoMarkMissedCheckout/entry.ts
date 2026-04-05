import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  // Get today's date in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().slice(0, 10);

  // Get current academic year
  const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ is_current: true });
  const academicYear = academicYears?.[0]?.year || '';

  if (!academicYear) {
    return Response.json({ status: 'error', message: 'No current academic year found.' });
  }

  // Find staff who checked in today but have no checkout_time and are still marked Present
  const attendanceRecords = await base44.asServiceRole.entities.StaffAttendance.filter({
    date: today,
    academic_year: academicYear,
  });

  // Staff who have a checkin_time but no checkout_time and status is Present
  const missedCheckout = attendanceRecords.filter(r =>
    r.checkin_time && !r.checkout_time && r.status === 'Present'
  );

  if (missedCheckout.length === 0) {
    return Response.json({ status: 'ok', message: 'No missed checkouts found.', updated: 0 });
  }

  await Promise.all(missedCheckout.map(r =>
    base44.asServiceRole.entities.StaffAttendance.update(r.id, {
      status: 'Half Day',
      remarks: (r.remarks ? r.remarks + ' | ' : '') + 'Auto Half Day: missed check-out',
      marked_by: 'SYSTEM',
    })
  ));

  return Response.json({
    status: 'ok',
    date: today,
    updated: missedCheckout.length,
    staff: missedCheckout.map(r => r.staff_name),
  });
});