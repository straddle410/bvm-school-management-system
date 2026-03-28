import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || !['admin', 'principal', 'accountant'].includes((user.role || '').toLowerCase())) {
    return Response.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY');
  if (!AUTH_KEY) return Response.json({ error: 'MSG91_AUTH_KEY not set' }, { status: 500 });

  // Fetch all active, non-deleted students with a phone number
  const allStudents = [];
  let skip = 0;
  while (true) {
    const batch = await base44.asServiceRole.entities.Student.filter(
      { is_deleted: false, is_active: true },
      '-created_date', 200, skip
    );
    const arr = Array.isArray(batch) ? batch : (batch?.results || []);
    if (!arr.length) break;
    allStudents.push(...arr);
    if (arr.length < 200) break;
    skip += 200;
  }

  const withPhone = allStudents.filter(s => s.parent_phone && s.parent_phone.trim() !== '');
  
  let checked = 0, waAvailable = 0, waUnavailable = 0, errors = 0;

  for (const student of withPhone) {
    let phone = student.parent_phone.trim().replace(/\D/g, '');
    // Ensure country code - add 91 if 10 digits
    if (phone.length === 10) phone = '91' + phone;

    try {
      const res = await fetch(
        `https://api.msg91.com/api/v5/whatsapp/check-number?authkey=${AUTH_KEY}&mobile=${phone}`,
        { method: 'GET', headers: { 'Content-Type': 'application/json' } }
      );
      const data = await res.json();
      console.log(`[WA CHECK] phone=${phone} status=${res.status} response=${JSON.stringify(data)}`);
      
      // MSG91 check-number response inspection
      const isAvailable = data?.message === 'number_exists' || data?.type === 'success';
      
      await base44.asServiceRole.entities.Student.update(student.id, {
        is_whatsapp_available: isAvailable
      });

      if (isAvailable) waAvailable++; else waUnavailable++;
      checked++;
    } catch {
      errors++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 100));
  }

  return Response.json({
    success: true,
    total_students: allStudents.length,
    with_phone: withPhone.length,
    checked,
    wa_available: waAvailable,
    wa_unavailable: waUnavailable,
    errors
  });
});