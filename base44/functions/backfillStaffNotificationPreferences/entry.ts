import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [prefs, staffAccounts] = await Promise.all([
    base44.asServiceRole.entities.StaffNotificationPreference.list(),
    base44.asServiceRole.entities.StaffAccount.list(),
  ]);

  const staffMap = new Map(staffAccounts.map(s => [s.id, s]));

  let updated = 0;
  let skipped = 0;

  for (const pref of prefs) {
    const staff = staffMap.get(pref.staff_id);
    if (!staff) { skipped++; continue; }

    const newCode = staff.staff_code || staff.username || '';
    const newName = staff.name || '';

    if (pref.staff_code === newCode && pref.staff_name === newName) { skipped++; continue; }

    await base44.asServiceRole.entities.StaffNotificationPreference.update(pref.id, {
      staff_code: newCode,
      staff_name: newName,
    });
    updated++;
  }

  return Response.json({ success: true, updated, skipped, total: prefs.length });
});