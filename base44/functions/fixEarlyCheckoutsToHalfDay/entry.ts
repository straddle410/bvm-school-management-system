import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin only' }, { status: 403 });
  }

  // Get kiosk settings for early checkout threshold
  const kioskList = await base44.asServiceRole.entities.KioskSettings.list();
  const earlyCheckoutTime = kioskList?.[0]?.early_checkout_time;

  if (!earlyCheckoutTime) {
    return Response.json({ error: 'No KioskSettings found with early_checkout_time' }, { status: 400 });
  }

  // Get all attendance records that have a checkout_time and are currently Present
  const allRecords = await base44.asServiceRole.entities.StaffAttendance.filter({ status: 'Present' });

  const toFix = allRecords.filter(r => {
    if (!r.checkout_time) return false;
    return r.checkout_time < earlyCheckoutTime;
  });

  let updated = 0;
  for (const r of toFix) {
    await base44.asServiceRole.entities.StaffAttendance.update(r.id, {
      status: 'Half Day',
      remarks: (r.remarks || '') + ' [auto-fixed: early checkout]',
    });
    updated++;
  }

  return Response.json({
    success: true,
    earlyCheckoutTime,
    totalChecked: allRecords.length,
    updated,
    message: `Fixed ${updated} records to Half Day (checkout before ${earlyCheckoutTime})`,
  });
});