import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get all staff accounts
    const staffAccounts = await base44.asServiceRole.entities.StaffAccount.list();
    console.log('\n=== STAFF ACCOUNTS ===');
    staffAccounts.forEach(s => {
      console.log(`${s.staff_code}: ${s.name} | Email: ${s.email || 'EMPTY'} | Username: ${s.username}`);
    });

    // Get all Base44 users
    const users = await base44.asServiceRole.entities.User.list();
    console.log('\n=== BASE44 USERS ===');
    users.forEach(u => {
      console.log(`${u.email} | Full Name: ${u.full_name} | Role: ${u.role}`);
    });

    return Response.json({
      staff_accounts: staffAccounts.map(s => ({
        staff_code: s.staff_code,
        name: s.name,
        email: s.email,
        username: s.username
      })),
      users: users.map(u => ({
        email: u.email,
        full_name: u.full_name,
        role: u.role
      }))
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});