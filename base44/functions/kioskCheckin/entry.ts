import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Returns 'HH:MM' string in IST from a Date object
function toISTTime(date) {
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(date.getTime() + istOffset);
  const h = String(ist.getUTCHours()).padStart(2, '0');
  const m = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

// Compare two HH:MM strings, returns -1/0/1
function compareTimes(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const { staff_code: rawPayload } = await req.json();

  if (!rawPayload) {
    return Response.json({ status: 'error', message: 'No QR code provided.' }, { status: 400 });
  }

  // New QR format: "staff_code|qr_token"
  const parts = rawPayload.trim().split('|');
  const staff_code = parts[0];
  const scanned_token = parts[1] || null;

  // Find staff by staff_code — optimized single lookup with early return
  const staffList = await base44.asServiceRole.entities.StaffAccount.filter({ staff_code: staff_code.trim(), is_active: true });
  if (!staffList?.length) {
    return Response.json({ status: 'error', message: 'Staff not found.' }, { status: 400 });
  }
  const staff = staffList[0];



  // Validate QR token — if staff has a qr_token set, the scanned token MUST match
  if (staff.qr_token) {
    if (!scanned_token || scanned_token !== staff.qr_token) {
      return Response.json({ status: 'error', message: 'Invalid or expired QR card. Please get a new card from admin.' });
    }
  }

  // Get today's date in IST (YYYY-MM-DD)
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  const today = istDate.toISOString().split('T')[0];

  // Get current IST time string
  const nowTime = toISTTime(now);

  // Get current academic year + kiosk settings in parallel
  const [academicYears, kioskSettingsList] = await Promise.all([
    base44.asServiceRole.entities.AcademicYear.filter({ is_current: true }),
    base44.asServiceRole.entities.KioskSettings.list(),
  ]);
  const academicYear = academicYears?.[0]?.year || '';
  const kioskSettings = kioskSettingsList?.[0] || null;
  const lateCheckinTime = kioskSettings?.late_checkin_time || null;
  const earlyCheckoutTime = kioskSettings?.early_checkout_time || null;

  // Check if already has a record for today
  const existing = await base44.asServiceRole.entities.StaffAttendance.filter({
    staff_id: staff.id,
    date: today,
  });

  if (existing && existing.length > 0) {
    const record = existing[0];

    // Already checked out today
    if (record.checkout_time) {
      return Response.json({ status: 'already_checked_in', staff_name: staff.name });
    }

    // Has check-in but no checkout - check 30-min minimum before allowing checkout
    if (record.checkin_time) {
      const [ciH, ciM] = record.checkin_time.split(':').map(Number);
      const [nowH, nowM] = nowTime.split(':').map(Number);
      const minutesSinceCheckin = (nowH * 60 + nowM) - (ciH * 60 + ciM);

      if (minutesSinceCheckin < 30) {
        return Response.json({ status: 'already_checked_in', staff_name: staff.name });
      }

      let newStatus = record.status;
      if (earlyCheckoutTime && compareTimes(nowTime, earlyCheckoutTime) < 0) {
        newStatus = 'Half Day';
      }
      const checkoutRemarks = 'Check-in: ' + record.checkin_time + ', Check-out: ' + nowTime + (newStatus === 'Half Day' ? ' (early checkout)' : '');
      await base44.asServiceRole.entities.StaffAttendance.update(record.id, {
        checkout_time: nowTime,
        status: newStatus,
        remarks: checkoutRemarks,
      });
      return Response.json({
        status: 'checkout_success',
        staff_name: staff.name,
        checkin_time: record.checkin_time,
        checkout_time: nowTime,
        attendance_status: newStatus,
      });
    }

    // Record exists (Absent pre-init) but no checkin_time → treat as first scan / check-in
    let checkInStatus = 'Present';
    if (lateCheckinTime && compareTimes(nowTime, lateCheckinTime) > 0) {
      checkInStatus = 'Half Day';
    }
    await base44.asServiceRole.entities.StaffAttendance.update(record.id, {
      status: checkInStatus,
      checkin_time: nowTime,
      marked_by: 'KIOSK',
      remarks: `Check-in: ${nowTime}${checkInStatus === 'Half Day' ? ' (late arrival)' : ''}`,
    });
    return Response.json({
      status: 'success',
      staff_name: staff.name,
      checkin_time: nowTime,
      attendance_status: checkInStatus,
    });
  }

  // No record yet — first scan, create check-in record
  let checkInStatus = 'Present';
  if (lateCheckinTime && compareTimes(nowTime, lateCheckinTime) > 0) {
    checkInStatus = 'Half Day';
  }
  await base44.asServiceRole.entities.StaffAttendance.create({
    staff_id: staff.id,
    staff_name: staff.name,
    date: today,
    status: checkInStatus,
    checkin_time: nowTime,
    academic_year: academicYear,
    marked_by: 'KIOSK',
    remarks: `Check-in: ${nowTime}${checkInStatus === 'Half Day' ? ' (late arrival)' : ''}`,
  });

  return Response.json({
    status: 'success',
    staff_name: staff.name,
    checkin_time: nowTime,
    attendance_status: checkInStatus,
  });
});