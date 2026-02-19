import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (new_password.length < 6) {
      return Response.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    // Verify current password by attempting login
    const staffAccounts = await base44.asServiceRole.entities.StaffAccount.filter({
      email: user.email
    });

    if (staffAccounts.length === 0) {
      return Response.json({ error: 'Staff account not found' }, { status: 404 });
    }

    const staffAccount = staffAccounts[0];

    // Simple password verification (comparing with stored temp_password or previous password)
    // In production, you'd want proper password hashing
    if (staffAccount.temp_password !== current_password) {
      return Response.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Update the staff account with new password
    await base44.asServiceRole.entities.StaffAccount.update(staffAccount.id, {
      temp_password: new_password,
      must_change_password: false
    });

    return Response.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});