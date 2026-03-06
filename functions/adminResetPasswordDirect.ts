import bcrypt from 'npm:bcryptjs@2.4.3';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { username, new_password } = await req.json();

    if (!username || !new_password) {
      return Response.json({ error: 'Missing username or new_password' }, { status: 400 });
    }

    const staff = await base44.asServiceRole.entities.StaffAccount.filter({ username });
    if (!staff || staff.length === 0) {
      return Response.json({ error: 'Staff not found' }, { status: 404 });
    }

    const hash = await bcrypt.hash(new_password, 10);

    await base44.asServiceRole.entities.StaffAccount.update(staff[0].id, {
      password_hash: hash,
      password_updated_at: new Date().toISOString(),
      force_password_change: false,
      failed_login_attempts: 0,
      account_locked_until: null,
    });

    return Response.json({ success: true, message: `Password reset for ${username}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});