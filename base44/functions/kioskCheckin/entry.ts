import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { staff_code } = await req.json();

  if (!staff_code) {
    return Response.json({ status: 'error', message: 'No staff code provided.' }, { status: 400 });
  }

  // Find staff by staff_code
  const staffList = await base44.asServiceRole.entities.StaffAccount.filter({ staff_code: staff_code.trim() });

  if (!staffList || staffList.length === 0) {
    return Response.json({ status: 'error', message: 'Staff not found. Please contact admin.' });
  }

  const staff = staffList[0];

  if (!staff.is_active) {
    return Response.json({ status: 'error', message: 'This account is inactive. Please contact admin.' });
  }

  // Get today's date in IST (YYYY-MM-DD)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().split('T')[0];

  // Get current academic year
  const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({ is_current: true });
  const academicYear = academicYears?.[0]?.year || '';

  // Check if already has a record for today
  const existing = await base44.asServiceRole.entities.StaffAttendance.filter({
    staff_id: staff.id,
    date: today,
  });

  if (existing && existing.length > 0) {
    const record = existing[0];
    if (record.status === 'Present') {
      return Response.json({
        status: 'already_checked_in',
        staff_name: staff.name,
      });
    }
    // Was Absent (pre-initialized) — update to Present
    await base44.asServiceRole.entities.StaffAttendance.update(record.id, {
      status: 'Present',
      marked_by: 'KIOSK',
      remarks: 'Auto check-in via QR Kiosk',
    });
    return Response.json({
      status: 'success',
      staff_name: staff.name,
    });
  }

  // No record yet — create attendance record
  await base44.asServiceRole.entities.StaffAttendance.create({
    staff_id: staff.id,
    staff_name: staff.name,
    date: today,
    status: 'Present',
    academic_year: academicYear,
    marked_by: 'KIOSK',
    remarks: 'Auto check-in via QR Kiosk',
  });

  return Response.json({
    status: 'success',
    staff_name: staff.name,
  });
});