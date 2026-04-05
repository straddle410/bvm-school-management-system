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

  // Get all active staff
  const staffList = await base44.asServiceRole.entities.StaffAccount.filter({ is_active: true });

  if (!staffList || staffList.length === 0) {
    return Response.json({ status: 'ok', message: 'No active staff found.', count: 0 });
  }

  // Get existing attendance records for today
  const existing = await base44.asServiceRole.entities.StaffAttendance.filter({
    date: today,
    academic_year: academicYear,
  });

  const existingStaffIds = new Set(existing.map(r => r.staff_id));

  // Create Absent records only for staff who don't have a record yet
  const toCreate = staffList.filter(s => !existingStaffIds.has(s.id));

  await Promise.all(toCreate.map(s =>
    base44.asServiceRole.entities.StaffAttendance.create({
      staff_id: s.id,
      staff_name: s.name,
      date: today,
      status: 'Absent',
      academic_year: academicYear,
      marked_by: 'SYSTEM',
      remarks: 'Auto-initialized as Absent',
    })
  ));

  return Response.json({
    status: 'ok',
    date: today,
    total_staff: staffList.length,
    initialized: toCreate.length,
    already_had_record: existingStaffIds.size,
  });
});